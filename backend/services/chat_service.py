import boto3
from botocore.exceptions import BotoCoreError, ClientError
from config import settings
from vector_store import vector_store
import logging
from typing import List, Dict, Any, Iterator, Tuple
import json

logger = logging.getLogger(__name__)


class ChatService:
    def __init__(self):
        self.model_id = settings.BEDROCK_MODEL_ID
        self.inference_profile_id = settings.BEDROCK_INFERENCE_PROFILE_ID
        self.invocation_model_id = self.inference_profile_id or self.model_id
        self.client = self._initialize_bedrock_client()

    def _initialize_bedrock_client(self):
        client_kwargs = {
            "region_name": settings.AWS_REGION,
        }

        if settings.AWS_PROFILE:
            session = boto3.Session(profile_name=settings.AWS_PROFILE)
            client_factory = session.client
        else:
            client_factory = boto3.client

        if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
            client_kwargs["aws_access_key_id"] = settings.AWS_ACCESS_KEY_ID
            client_kwargs["aws_secret_access_key"] = settings.AWS_SECRET_ACCESS_KEY

        if settings.AWS_SESSION_TOKEN:
            client_kwargs["aws_session_token"] = settings.AWS_SESSION_TOKEN

        return client_factory("bedrock-runtime", **client_kwargs)

    def _build_context(self, query: str) -> List[Dict[str, Any]]:
        """Pull top local Chroma chunks from relevant collections."""
        try:
            collections = [
                "schemes_index",
                "citizen_faq_index",
                settings.CHROMA_COLLECTION_NAME,
            ]

            all_hits = []
            for collection in collections:
                hits = vector_store.search(
                    query,
                    top_k=4,
                    collection_name=collection,
                )
                for hit in hits:
                    metadata = hit.get("metadata") or {}
                    metadata["collection_name"] = collection
                    hit["metadata"] = metadata
                all_hits.extend(hits)

            # Keep the highest scoring unique chunks across collections.
            dedup = {}
            for item in all_hits:
                item_id = item.get("id")
                if not item_id:
                    continue
                if item_id not in dedup or item.get("score", 0) > dedup[item_id].get("score", 0):
                    dedup[item_id] = item

            ranked = sorted(dedup.values(), key=lambda x: x.get("score", 0), reverse=True)
            return ranked[:6]
        except Exception as e:
            logger.warning(f"Vector context retrieval failed: {e}")
            return []

    def _extract_text(self, response: Dict[str, Any]) -> str:
        content = response.get("output", {}).get("message", {}).get("content", [])
        parts = [item.get("text", "") for item in content if isinstance(item, dict)]
        return "\n".join([p for p in parts if p]).strip()

    def _build_prompt_and_sources(self, user_query: str) -> Tuple[str, List[str]]:
        context_docs = self._build_context(user_query)

        context_text = "\n\n".join(
            [f"Context {i + 1}: {doc.get('text', '')}" for i, doc in enumerate(context_docs)]
        )

        prompt = (
            "You are GramSaarthi assistant for Indian rural governance and schemes. "
            "Answer clearly, practically, and in simple language. "
            "Use deliberate step-by-step reasoning internally, but do not expose your chain-of-thought. "
            "Return only the final answer and concise actionable bullets. "
            "If context is insufficient, say what is missing.\n\n"
            f"User Question:\n{user_query}\n\n"
            f"Retrieved Context:\n{context_text if context_text else 'No retrieved context available.'}"
        )

        sources = []
        for doc in context_docs:
            metadata = doc.get("metadata", {}) or {}
            src = (
                metadata.get("scheme_name")
                or metadata.get("filename")
                or metadata.get("target_index")
                or metadata.get("collection_name")
            )
            if src and src not in sources:
                sources.append(src)

        if not sources:
            sources = ["AWS Bedrock Nova Lite"]

        return prompt, sources

    def _request_body(self, prompt: str) -> Dict[str, Any]:
        return {
            "schemaVersion": "messages-v1",
            "system": [
                {
                    "text": "You are a helpful policy and scheme assistant. Think step-by-step internally and provide concise final answers only."
                }
            ],
            "messages": [
                {
                    "role": "user",
                    "content": [{"text": prompt}],
                }
            ],
            "inferenceConfig": {
                "maxTokens": settings.BEDROCK_MAX_TOKENS,
                "temperature": settings.BEDROCK_TEMPERATURE,
            },
        }

    def _extract_stream_text(self, payload: Dict[str, Any]) -> str:
        # Handle different Bedrock stream chunk shapes.
        if "outputText" in payload:
            return payload.get("outputText") or ""
        if "delta" in payload and isinstance(payload["delta"], dict):
            return payload["delta"].get("text") or ""
        if "contentBlockDelta" in payload:
            return payload["contentBlockDelta"].get("delta", {}).get("text") or ""
        return ""

    def generate_response(self, user_query: str) -> Dict[str, Any]:
        prompt, sources = self._build_prompt_and_sources(user_query)

        try:
            request_body = self._request_body(prompt)

            raw_response = self.client.invoke_model(
                modelId=self.invocation_model_id,
                body=json.dumps(request_body),
                contentType="application/json",
                accept="application/json",
            )

            parsed_response = json.loads(raw_response["body"].read())
            answer = self._extract_text(parsed_response)
            if not answer:
                answer = "I could not generate a response right now. Please try again."

            return {
                "response": answer,
                "sources": sources,
                "confidence": 0.85,
            }

        except (ClientError, BotoCoreError) as e:
            logger.error(f"Bedrock Nova Lite error (modelId={self.invocation_model_id}): {e}")
            raise RuntimeError("Failed to get response from AWS Bedrock")

    def stream_response(self, user_query: str) -> Tuple[Iterator[str], List[str], float]:
        prompt, sources = self._build_prompt_and_sources(user_query)

        try:
            request_body = self._request_body(prompt)
            stream_resp = self.client.invoke_model_with_response_stream(
                modelId=self.invocation_model_id,
                body=json.dumps(request_body),
                contentType="application/json",
                accept="application/json",
            )

            def _iterator() -> Iterator[str]:
                for event in stream_resp.get("body", []):
                    chunk = event.get("chunk")
                    if not chunk:
                        continue
                    payload = json.loads(chunk["bytes"].decode("utf-8"))
                    text = self._extract_stream_text(payload)
                    if text:
                        yield text

            return _iterator(), sources, 0.85

        except (ClientError, BotoCoreError, AttributeError) as e:
            logger.warning(f"Streaming unavailable, falling back to non-streaming: {e}")
            # Fallback to non-streaming Bedrock call and chunk output for UI streaming.
            response = self.generate_response(user_query)
            text = response.get("response", "")

            def _fallback_iter() -> Iterator[str]:
                words = text.split(" ")
                for i, word in enumerate(words):
                    if i == len(words) - 1:
                        yield word
                    else:
                        yield word + " "

            return _fallback_iter(), response.get("sources", sources), response.get("confidence", 0.85)


chat_service = ChatService()
