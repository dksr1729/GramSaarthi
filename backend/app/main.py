import hashlib
import io
import json
import uuid
from datetime import datetime, timezone
from typing import Any, Optional
from urllib.parse import urlparse

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from .config import get_settings

settings = get_settings()

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED_ROLES = {"District Admin", "Rural User", "Panchayat Officer"}


class RegisterRequest(BaseModel):
    name: str
    login_id: str
    password: str
    role: str


class LoginRequest(BaseModel):
    login_id: str
    password: str
    role: str


class ChatHistoryItem(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    role: str
    name: str
    message: str
    history: list[ChatHistoryItem] = Field(default_factory=list)
    rag_filters: dict[str, str] = Field(default_factory=dict)


def _hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def _get_users_table():
    dynamodb = boto3.resource("dynamodb", region_name=settings.aws_region)
    return dynamodb.Table(settings.dynamodb_users_table)


def _get_bedrock_runtime_client():
    return boto3.client("bedrock-runtime", region_name=settings.aws_region)


def _get_aoss_client():
    try:
        from opensearchpy import AWSV4SignerAuth, OpenSearch, RequestsHttpConnection
    except ImportError as exc:
        raise HTTPException(
            status_code=500,
            detail="Missing dependency: opensearch-py is not installed on backend",
        ) from exc

    endpoint = settings.aoss_endpoint.strip()
    if not endpoint:
        raise HTTPException(status_code=500, detail="AOSS_ENDPOINT is not configured")

    parsed_endpoint = urlparse(endpoint if "://" in endpoint else f"https://{endpoint}")
    host = parsed_endpoint.netloc or parsed_endpoint.path

    if not host:
        raise HTTPException(status_code=500, detail="Invalid AOSS endpoint configuration")

    session = boto3.Session(region_name=settings.aws_region)
    credentials = session.get_credentials()
    if credentials is None:
        raise HTTPException(status_code=500, detail="AWS credentials are not available for AOSS")

    auth = AWSV4SignerAuth(credentials, settings.aws_region, "aoss")

    return OpenSearch(
        hosts=[{"host": host, "port": 443}],
        http_auth=auth,
        use_ssl=True,
        verify_certs=True,
        connection_class=RequestsHttpConnection,
        timeout=30,
    )


def _normalize_filters(filters_raw: Optional[str]) -> dict[str, str]:
    if not filters_raw or not filters_raw.strip():
        return {}

    try:
        parsed = json.loads(filters_raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Filters must be valid JSON") from exc

    if not isinstance(parsed, dict):
        raise HTTPException(status_code=400, detail="Filters must be a key-value object")

    if len(parsed) > 5:
        raise HTTPException(status_code=400, detail="You can add up to 5 filters only")

    normalized: dict[str, str] = {}
    for key, value in parsed.items():
        normalized_key = str(key).strip()
        normalized_value = str(value).strip()
        if not normalized_key or not normalized_value:
            raise HTTPException(status_code=400, detail="Filter keys and values must be non-empty")
        normalized[normalized_key] = normalized_value

    return normalized


def _normalize_filter_map(filters_map: Optional[dict[str, str]]) -> dict[str, str]:
    if not filters_map:
        return {}

    if len(filters_map) > 5:
        raise HTTPException(status_code=400, detail="You can add up to 5 filters only")

    normalized: dict[str, str] = {}
    for key, value in filters_map.items():
        normalized_key = str(key).strip()
        normalized_value = str(value).strip()
        if not normalized_key or not normalized_value:
            raise HTTPException(status_code=400, detail="Filter keys and values must be non-empty")
        normalized[normalized_key] = normalized_value

    return normalized


def _chunk_text(text: str) -> list[str]:
    normalized_text = " ".join(text.split())
    if not normalized_text:
        return []

    chunk_size = max(200, settings.ingestion_chunk_size)
    chunk_overlap = max(0, min(settings.ingestion_chunk_overlap, chunk_size - 1))

    chunks: list[str] = []
    start = 0

    while start < len(normalized_text):
        end = min(start + chunk_size, len(normalized_text))
        chunk = normalized_text[start:end].strip()
        if chunk:
            chunks.append(chunk)

        if end >= len(normalized_text):
            break

        start = end - chunk_overlap

    return chunks


def _extract_pdf_chunks(file_bytes: bytes) -> list[dict[str, Any]]:
    try:
        import pdfplumber
    except ImportError as exc:
        raise HTTPException(
            status_code=500,
            detail="Missing dependency: pdfplumber is not installed on backend",
        ) from exc

    chunks: list[dict[str, Any]] = []

    try:
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            for page_number, page in enumerate(pdf.pages, start=1):
                page_text = (page.extract_text() or "").strip()
                if not page_text:
                    continue

                text_chunks = _chunk_text(page_text)
                for chunk_number, chunk in enumerate(text_chunks, start=1):
                    chunks.append(
                        {
                            "page_number": page_number,
                            "chunk_number": chunk_number,
                            "content": chunk,
                        }
                    )
    except Exception as exc:  # pylint: disable=broad-exception-caught
        raise HTTPException(status_code=400, detail=f"Unable to parse PDF file: {exc}") from exc

    return chunks


def _embed_text(text: str) -> list[float]:
    client = _get_bedrock_runtime_client()

    try:
        response = client.invoke_model(
            modelId=settings.bedrock_embedding_model_id,
            contentType="application/json",
            accept="application/json",
            body=json.dumps({"inputText": text}),
        )
    except (ClientError, BotoCoreError) as exc:
        raise HTTPException(status_code=500, detail=f"Embedding request failed: {exc}") from exc

    try:
        payload = json.loads(response["body"].read())
        embedding = payload.get("embedding")
        if not isinstance(embedding, list) or not embedding:
            raise ValueError("embedding not present")
        return [float(item) for item in embedding]
    except Exception as exc:  # pylint: disable=broad-exception-caught
        raise HTTPException(status_code=500, detail=f"Invalid embedding response: {exc}") from exc


def _ensure_aoss_index(client, vector_dimension: int) -> None:
    try:
        if client.indices.exists(index=settings.aoss_index_name):
            return

        client.indices.create(
            index=settings.aoss_index_name,
            body={
                "settings": {"index": {"knn": True}},
                "mappings": {
                    "properties": {
                        "content": {"type": "text"},
                        settings.aoss_vector_field: {
                            "type": "knn_vector",
                            "dimension": vector_dimension,
                        },
                        "metadata": {"type": "object", "dynamic": True},
                    }
                },
            },
        )
    except Exception as exc:  # pylint: disable=broad-exception-caught
        raise HTTPException(status_code=500, detail=f"Failed to ensure AOSS index: {exc}") from exc


def _retrieve_rag_chunks(rag_filters: dict[str, str]) -> list[str]:
    if not rag_filters:
        return []

    client = _get_aoss_client()
    filter_clauses = [
        {"term": {f"metadata.{key}.keyword": value}}
        for key, value in rag_filters.items()
    ]

    query = {
        "size": settings.rag_top_k,
        "_source": ["content", "metadata"],
        "query": {"bool": {"filter": filter_clauses}},
    }

    try:
        response = client.search(index=settings.aoss_index_name, body=query)
    except Exception as exc:  # pylint: disable=broad-exception-caught
        raise HTTPException(status_code=500, detail=f"RAG retrieval failed: {exc}") from exc

    hits = response.get("hits", {}).get("hits", [])
    chunks: list[str] = []
    max_chars = settings.rag_max_context_chars
    used_chars = 0

    for hit in hits:
        content = str(hit.get("_source", {}).get("content", "")).strip()
        if not content:
            continue
        if used_chars + len(content) > max_chars:
            remaining = max_chars - used_chars
            if remaining > 0:
                chunks.append(content[:remaining])
            break
        chunks.append(content)
        used_chars += len(content)

    return chunks


def _to_bedrock_messages(history: list[ChatHistoryItem], user_message: str) -> list[dict[str, Any]]:
    messages: list[dict[str, Any]] = []

    for item in history[-8:]:
        normalized_role = "assistant" if item.role == "assistant" else "user"
        text = item.content.strip()
        if text:
            messages.append({"role": normalized_role, "content": [{"text": text}]})

    # Bedrock Converse requires the conversation to start with a user message.
    while messages and messages[0]["role"] != "user":
        messages.pop(0)

    messages.append({"role": "user", "content": [{"text": user_message.strip()}]})
    return messages


@app.get(f"{settings.api_v1_prefix}/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": settings.app_name}


@app.get(f"{settings.api_v1_prefix}/branding")
def branding() -> dict[str, str]:
    return {
        "name": "GramSaarthi",
        "tagline": "Modern village governance intelligence",
        "description": "A clean, public-facing digital experience for GramSaarthi.",
    }


@app.post(f"{settings.api_v1_prefix}/auth/register")
def register_user(payload: RegisterRequest) -> dict[str, str]:
    login_id = payload.login_id.lower().strip()
    role = payload.role.strip()

    if role not in ALLOWED_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role selected")

    if "@" not in login_id or "." not in login_id:
        raise HTTPException(status_code=400, detail="Invalid login ID format")

    if len(payload.password) < 4:
        raise HTTPException(
            status_code=400, detail="Password must be at least 4 characters"
        )

    users_table = _get_users_table()
    key = {settings.dynamodb_users_pk_name: role, settings.dynamodb_users_sk_name: login_id}

    try:
        existing_user = users_table.get_item(Key=key)
    except (ClientError, BotoCoreError) as exc:
        raise HTTPException(status_code=500, detail=f"Unable to read users table: {exc}") from exc

    if existing_user.get("Item") is not None:
        raise HTTPException(status_code=409, detail="Login ID already registered for this role")

    item = {
        settings.dynamodb_users_pk_name: role,
        settings.dynamodb_users_sk_name: login_id,
        "name": payload.name.strip(),
        "password_hash": _hash_password(payload.password),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        users_table.put_item(Item=item)
    except (ClientError, BotoCoreError) as exc:
        raise HTTPException(status_code=500, detail="Unable to save registration") from exc

    return {
        "message": "Registration successful",
        "name": item["name"],
        "login_id": login_id,
        "role": role,
    }


@app.post(f"{settings.api_v1_prefix}/auth/login")
def login_user(payload: LoginRequest) -> dict[str, str]:
    login_id = payload.login_id.lower().strip()
    role = payload.role.strip()

    if role not in ALLOWED_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role selected")

    if "@" not in login_id or "." not in login_id:
        raise HTTPException(status_code=400, detail="Invalid login ID format")

    users_table = _get_users_table()
    key = {settings.dynamodb_users_pk_name: role, settings.dynamodb_users_sk_name: login_id}

    try:
        response = users_table.get_item(Key=key)
    except (ClientError, BotoCoreError) as exc:
        raise HTTPException(status_code=500, detail="Unable to read users table") from exc

    user = response.get("Item")

    if user is None:
        raise HTTPException(status_code=404, detail="User not found for selected role")

    if _hash_password(payload.password) != user["password_hash"]:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return {
        "message": "Login successful",
        "name": user["name"],
        "login_id": login_id,
        "role": role,
    }


@app.post(f"{settings.api_v1_prefix}/ingestion/pdf")
async def ingest_pdf_to_aoss(
    role: str = Form(...),
    name: str = Form(...),
    file: UploadFile = File(...),
    filters: Optional[str] = Form(default=None),
) -> dict[str, Any]:
    selected_role = role.strip()
    if selected_role != "District Admin":
        raise HTTPException(status_code=403, detail="Only District Admin can upload and ingest PDFs")

    if not file.filename:
        raise HTTPException(status_code=400, detail="File name is required")

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    metadata_tags = _normalize_filters(filters)
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    chunks = _extract_pdf_chunks(file_bytes)
    if not chunks:
        raise HTTPException(status_code=400, detail="No readable text found in PDF")

    aoss_client = _get_aoss_client()

    first_embedding = _embed_text(chunks[0]["content"])
    _ensure_aoss_index(aoss_client, len(first_embedding))

    ingested_at = datetime.now(timezone.utc).isoformat()
    document_group_id = str(uuid.uuid4())

    indexed_count = 0

    try:
        for index, chunk in enumerate(chunks, start=1):
            embedding = first_embedding if index == 1 else _embed_text(chunk["content"])

            body = {
                "content": chunk["content"],
                settings.aoss_vector_field: embedding,
                "metadata": {
                    **metadata_tags,
                    "document_group_id": document_group_id,
                    "file_name": file.filename,
                    "page_number": chunk["page_number"],
                    "chunk_number": chunk["chunk_number"],
                    "uploaded_by": name.strip(),
                    "uploader_role": selected_role,
                    "ingested_at": ingested_at,
                },
            }

            aoss_client.index(index=settings.aoss_index_name, body=body)
            indexed_count += 1
    except Exception as exc:  # pylint: disable=broad-exception-caught
        raise HTTPException(status_code=500, detail=f"Failed to ingest PDF chunks into AOSS: {exc}") from exc

    return {
        "message": "PDF ingestion successful",
        "index_name": settings.aoss_index_name,
        "chunks_indexed": indexed_count,
        "filters": metadata_tags,
    }


@app.post(f"{settings.api_v1_prefix}/chat/stream")
def stream_chat(payload: ChatRequest) -> StreamingResponse:
    selected_role = payload.role.strip()
    if selected_role not in ALLOWED_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role selected")

    if not payload.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    rag_filters = _normalize_filter_map(payload.rag_filters)
    rag_chunks: list[str] = []
    rag_note = ""
    if rag_filters:
        try:
            rag_chunks = _retrieve_rag_chunks(rag_filters)
            if not rag_chunks:
                rag_note = "No knowledge chunks matched the selected filters."
        except HTTPException as exc:
            rag_note = str(exc.detail)

    system_prompt = (
        "You are GramSaarthi AI, a concise and practical assistant for Indian rural governance workflows. "
        f"Current logged-in user role: {selected_role}. "
        f"Current logged-in user name: {payload.name.strip()}. "
        "Provide actionable answers, keep tone clear, and avoid hallucinating government facts. "
        "If data is missing, clearly state assumptions."
    )
    if rag_chunks:
        formatted_chunks = "\n\n".join(
            [f"[Chunk {index}] {chunk}" for index, chunk in enumerate(rag_chunks, start=1)]
        )
        system_prompt += (
            "\nUse the following retrieved knowledge chunks when relevant. "
            "For local facts, prefer chunk evidence:\n"
            f"{formatted_chunks}"
        )
    if rag_note:
        system_prompt += f"\nRAG retrieval note: {rag_note}"

    messages = _to_bedrock_messages(payload.history, payload.message)

    def event_stream():
        selected_model_identifier = settings.bedrock_model_identifier
        try:
            client = _get_bedrock_runtime_client()
            response = client.converse_stream(
                modelId=selected_model_identifier,
                system=[{"text": system_prompt}],
                messages=messages,
                inferenceConfig={
                    "maxTokens": settings.bedrock_max_tokens,
                    "temperature": settings.bedrock_temperature,
                },
            )

            for event in response.get("stream", []):
                if "contentBlockDelta" in event:
                    text = event["contentBlockDelta"].get("delta", {}).get("text", "")
                    if text:
                        yield f"data: {json.dumps({'type': 'delta', 'text': text})}\n\n"

                if "messageStop" in event:
                    yield "data: {\"type\": \"done\"}\n\n"
        except (ClientError, BotoCoreError) as exc:
            payload = {
                "type": "error",
                "message": (
                    f"Bedrock request failed: {exc}. "
                    f"region={settings.aws_region}, modelId={selected_model_identifier}"
                ),
            }
            yield f"data: {json.dumps(payload)}\n\n"
        except Exception as exc:  # pylint: disable=broad-exception-caught
            payload = {"type": "error", "message": f"Unexpected error: {exc}"}
            yield f"data: {json.dumps(payload)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
