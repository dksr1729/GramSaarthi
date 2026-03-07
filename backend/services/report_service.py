import hashlib
import json
import logging
import os
import time
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import BotoCoreError, ClientError

from auth import get_location_key
from config import settings
from database import db_client
from vector_store import vector_store

logger = logging.getLogger(__name__)


DEDICATED_REPORT_QUESTIONS = [
    ("FINAL ANSWER", "Give a plain-language summary of this scheme/topic."),
    ("ELIGIBILITY", "Who is eligible? Include exclusions if relevant."),
    ("BENEFITS", "List key benefits with practical details."),
    ("HOW TO APPLY", "Provide step-by-step application flow."),
    ("DOCUMENTS REQUIRED", "List required documents clearly."),
    ("DEADLINES", "Mention timelines, deadlines, or validity periods if available."),
    ("FINANCIAL DETAILS", "Explain subsidy/assistance/loan support with limits if known."),
    ("COMMON PITFALLS", "What mistakes cause rejection or delays?"),
    ("PRACTICAL TIPS", "Give practical tips for applicants in rural/urban local contexts."),
    ("HELPLINE", "Give official help channels and where to verify latest updates."),
]


class ReportService:
    def __init__(self):
        self.reports_table = settings.DYNAMODB_REPORTS_TABLE
        self.report_dir = os.path.join(os.path.dirname(__file__), "..", "generated_reports")
        os.makedirs(self.report_dir, exist_ok=True)
        self.bedrock_client = self._initialize_bedrock_client()
        self.invocation_model_id = settings.BEDROCK_INFERENCE_PROFILE_ID or settings.BEDROCK_MODEL_ID

    def _initialize_bedrock_client(self):
        client_kwargs = {"region_name": settings.AWS_REGION}

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

    def _report_id(self, topic: str) -> str:
        return hashlib.sha256(topic.strip().lower().encode("utf-8")).hexdigest()[:16]

    def _retrieve_context(self, query: str, top_k: int, scheme_type_filter: str) -> Dict[str, Any]:
        filters = {"scheme_type": scheme_type_filter} if scheme_type_filter else None

        schemes_docs = vector_store.search(
            query,
            top_k=top_k,
            filters=filters,
            collection_name="schemes_index",
        )
        faq_docs = vector_store.search(
            query,
            top_k=top_k,
            filters=filters,
            collection_name="citizen_faq_index",
        )

        context_docs = sorted(schemes_docs + faq_docs, key=lambda x: x.get("score", 0), reverse=True)[:top_k]
        return {
            "context_docs": context_docs,
            "schemes_count": len(schemes_docs),
            "faq_count": len(faq_docs),
        }

    def _call_bedrock(self, prompt: str) -> str:
        body = {
            "schemaVersion": "messages-v1",
            "system": [
                {
                    "text": "You are a policy reporting assistant. Think step-by-step internally, but output concise final answer only."
                }
            ],
            "messages": [{"role": "user", "content": [{"text": prompt}]}],
            "inferenceConfig": {
                "maxTokens": settings.BEDROCK_MAX_TOKENS,
                "temperature": settings.BEDROCK_TEMPERATURE,
            },
        }

        try:
            response = self.bedrock_client.invoke_model(
                modelId=self.invocation_model_id,
                body=json.dumps(body),
                contentType="application/json",
                accept="application/json",
            )
            parsed = json.loads(response["body"].read())
            content = parsed.get("output", {}).get("message", {}).get("content", [])
            parts = [x.get("text", "") for x in content if isinstance(x, dict)]
            return "\n".join([p for p in parts if p]).strip()
        except (ClientError, BotoCoreError) as e:
            logger.error(f"Bedrock report generation failed: {e}")
            raise RuntimeError("Failed to generate report from Bedrock")

    def _compose_prompt(self, title: str, topic: str, question_instruction: str, context_docs: List[Dict[str, Any]]) -> str:
        context_text = "\n\n".join([f"Context {i + 1}: {doc.get('text', '')}" for i, doc in enumerate(context_docs)])
        return (
            f"Section: {title}\n"
            f"Topic: {topic}\n"
            f"Task: {question_instruction}\n\n"
            "Write only this section content with useful bullet points where relevant. "
            "If context is missing, explicitly mention what is missing.\n\n"
            f"Retrieved Context:\n{context_text if context_text else 'No context found.'}"
        )

    def _format_report_text(
        self,
        topic: str,
        report_id: str,
        confidence: float,
        section_outputs: List[Dict[str, str]],
        schemes_count: int,
        faq_count: int,
        duration: float,
    ) -> str:
        sections = []
        for section in section_outputs:
            sections.append(f"{section['title']}\n----------------------------------------------------------------------\n{section['content']}\n")

        return (
            "DUALRAG REPORT\n"
            "======================================================================\n"
            f"Question: {topic}\n"
            f"Generated Hash: {report_id}\n"
            f"Confidence: {int(confidence * 100)}%\n\n"
            + "\n".join(sections)
            + "\nRETRIEVAL SUMMARY\n"
            "----------------------------------------------------------------------\n"
            f"schemes_index docs: {schemes_count}\n"
            f"citizen_faq_index docs: {faq_count}\n"
            f"processing_time_seconds: {duration:.2f}\n"
        )

    def _save_report_file(self, report_id: str, report_text: str) -> str:
        path = os.path.join(self.report_dir, f"{report_id}.txt")
        with open(path, "w", encoding="utf-8") as f:
            f.write(report_text)
        return path

    def _save_report_pdf(self, report_id: str, report_text: str) -> str:
        path = os.path.join(self.report_dir, f"{report_id}.pdf")
        c = canvas.Canvas(path, pagesize=A4)
        width, height = A4

        margin_x = 40
        margin_top = 40
        line_height = 14
        max_chars = 100
        y = height - margin_top

        lines = []
        for raw_line in report_text.splitlines():
            line = raw_line or " "
            while len(line) > max_chars:
                lines.append(line[:max_chars])
                line = line[max_chars:]
            lines.append(line)

        c.setFont("Helvetica", 10)
        for line in lines:
            if y < margin_top:
                c.showPage()
                c.setFont("Helvetica", 10)
                y = height - margin_top
            c.drawString(margin_x, y, line)
            y -= line_height

        c.save()
        return path

    def ensure_report_artifact(self, report_id: str, report_text: str, file_format: str) -> str:
        if file_format == "txt":
            return self._save_report_file(report_id, report_text)
        if file_format == "pdf":
            return self._save_report_pdf(report_id, report_text)
        raise ValueError("Unsupported file format")

    async def ask_question(self, query: str, scheme_type_filter: str = "", top_k: int = 8) -> Dict[str, Any]:
        retrieval = self._retrieve_context(query=query, top_k=top_k, scheme_type_filter=scheme_type_filter)
        prompt = self._compose_prompt(
            title="QUESTION RESPONSE",
            topic=query,
            question_instruction="Answer this question directly and concisely for users.",
            context_docs=retrieval["context_docs"],
        )
        answer = self._call_bedrock(prompt)

        sources = []
        for doc in retrieval["context_docs"]:
            meta = doc.get("metadata") or {}
            src = meta.get("scheme_name") or meta.get("filename") or meta.get("target_index")
            if src and src not in sources:
                sources.append(src)

        if not sources:
            sources = ["AWS Bedrock Nova Lite"]

        return {
            "question": query,
            "answer": answer,
            "sources": sources,
            "confidence": 0.85,
        }

    async def generate_report(
        self,
        topic: str,
        current_user: Dict[str, Any],
        scheme_type_filter: str = "",
        top_k: int = 8,
    ) -> Dict[str, Any]:
        start = time.time()
        report_id = self._report_id(topic)
        location_key = get_location_key(current_user)

        section_outputs: List[Dict[str, str]] = []
        total_schemes = 0
        total_faq = 0

        for title, question_instruction in DEDICATED_REPORT_QUESTIONS:
            query = f"{topic}. {question_instruction}"
            retrieval = self._retrieve_context(query=query, top_k=top_k, scheme_type_filter=scheme_type_filter)
            total_schemes += retrieval["schemes_count"]
            total_faq += retrieval["faq_count"]

            prompt = self._compose_prompt(
                title=title,
                topic=topic,
                question_instruction=question_instruction,
                context_docs=retrieval["context_docs"],
            )
            content = self._call_bedrock(prompt)
            section_outputs.append({"title": title, "content": content})

        confidence = 0.9
        duration = time.time() - start

        report_text = self._format_report_text(
            topic=topic,
            report_id=report_id,
            confidence=confidence,
            section_outputs=section_outputs,
            schemes_count=total_schemes,
            faq_count=total_faq,
            duration=duration,
        )

        file_path = self._save_report_file(report_id, report_text)
        now = datetime.utcnow().isoformat()

        item = {
            "location_key": location_key,
            "report_id": report_id,
            "question": topic,
            "report_text": report_text,
            "file_path": file_path,
            "report_mode": "dedicated_10q",
            "scheme_type_filter": scheme_type_filter,
            "top_k": int(top_k),
            "confidence": Decimal(str(confidence)),
            "generated_at": now,
            "updated_at": now,
        }
        db_client.put_item(self.reports_table, item)

        return {
            "report_id": report_id,
            "question": topic,
            "report_text": report_text,
            "confidence": confidence,
            "generated_at": now,
        }

    async def list_reports(self, current_user: Dict[str, Any]) -> List[Dict[str, Any]]:
        location_key = get_location_key(current_user)
        table = db_client.get_table(self.reports_table)
        response = table.query(KeyConditionExpression=Key("location_key").eq(location_key), ScanIndexForward=False)

        reports = []
        for item in response.get("Items", []):
            reports.append(
                {
                    "report_id": item.get("report_id"),
                    "question": item.get("question", ""),
                    "confidence": float(item.get("confidence", 0.0)),
                    "generated_at": item.get("generated_at", ""),
                }
            )
        return reports

    async def get_report(self, current_user: Dict[str, Any], report_id: str) -> Optional[Dict[str, Any]]:
        location_key = get_location_key(current_user)
        report = db_client.get_item(self.reports_table, {"location_key": location_key, "report_id": report_id})
        if not report:
            return None

        return {
            "report_id": report.get("report_id"),
            "question": report.get("question", ""),
            "report_text": report.get("report_text", ""),
            "confidence": float(report.get("confidence", 0.0)),
            "generated_at": report.get("generated_at", ""),
            "scheme_type_filter": report.get("scheme_type_filter", ""),
            "top_k": int(report.get("top_k", 8)),
            "report_mode": report.get("report_mode", "dedicated_10q"),
        }

    async def regenerate_report(self, current_user: Dict[str, Any], report_id: str) -> Dict[str, Any]:
        existing = await self.get_report(current_user, report_id)
        if not existing:
            raise ValueError("Report not found")

        return await self.generate_report(
            topic=existing.get("question", ""),
            current_user=current_user,
            scheme_type_filter=existing.get("scheme_type_filter", ""),
            top_k=int(existing.get("top_k", 8)),
        )


report_service = ReportService()
