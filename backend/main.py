from fastapi import FastAPI, HTTPException, Depends, status, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse, FileResponse
from config import settings
from models import (
    UserRegister, UserLogin, TokenResponse, QueryRequest, QueryResponse,
    ReportGenerateRequest, ReportResponse, SchemeResponse, PersonaEnum
)
from services.auth_service import auth_service
from services.location_service import location_service
from services.chat_service import chat_service
from services.report_service import report_service
from auth import get_current_user, require_persona
import logging
from typing import List
from datetime import datetime
from io import BytesIO
from uuid import uuid4
from pypdf import PdfReader
from vector_store import vector_store

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def _chunk_text(text: str, chunk_size: int = 1200, overlap: int = 200) -> List[str]:
    """Split text into overlapping chunks for embeddings."""
    normalized = " ".join(text.split())
    if not normalized:
        return []

    chunks = []
    start = 0
    text_len = len(normalized)

    while start < text_len:
        end = min(text_len, start + chunk_size)
        chunks.append(normalized[start:end])
        if end >= text_len:
            break
        start = max(0, end - overlap)

    return chunks


def _extract_pdf_text(content: bytes) -> str:
    """Extract text from PDF bytes."""
    reader = PdfReader(BytesIO(content))
    pages = [page.extract_text() or "" for page in reader.pages]
    return "\n".join(pages).strip()

# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    description="AI-powered decision-support system for Gram Panchayats",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Welcome to GramSaarthi API",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "environment": settings.ENVIRONMENT
    }


# Authentication endpoints
@app.post("/api/auth/register", response_model=TokenResponse)
async def register(user_data: UserRegister):
    """Register a new user"""
    try:
        # Validate location data
        is_valid = location_service.validate_location(
            user_data.state,
            user_data.district,
            user_data.mandal,
            user_data.village
        )
        
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid location data"
            )
        
        token_response = await auth_service.register_user(user_data)
        return token_response
    
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Registration error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to register user"
        )


@app.post("/api/auth/login", response_model=TokenResponse)
async def login(login_data: UserLogin):
    """Login user"""
    try:
        token_response = await auth_service.login_user(login_data)
        return token_response
    
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to login user"
        )


@app.get("/api/auth/me")
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """Get current user information"""
    try:
        user_info = await auth_service.get_user_info(current_user["gmail"])
        if not user_info:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        return user_info
    except Exception as e:
        logger.error(f"Error getting user info: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get user information"
        )


# Location endpoints
@app.get("/api/locations/states")
async def get_states():
    """Get list of states"""
    states = location_service.get_states()
    return {"states": states}


@app.get("/api/locations/districts/{state}")
async def get_districts(state: str):
    """Get list of districts for a state"""
    districts = location_service.get_districts(state)
    return {"districts": districts}


@app.get("/api/locations/mandals/{state}/{district}")
async def get_mandals(state: str, district: str):
    """Get list of mandals for a district"""
    mandals = location_service.get_mandals(state, district)
    return {"mandals": mandals}


@app.get("/api/locations/villages/{state}/{district}/{mandal}")
async def get_villages(state: str, district: str, mandal: str):
    """Get list of villages for a mandal"""
    villages = location_service.get_villages(state, district, mandal)
    return {"villages": villages}


# Query/Chatbot endpoint
@app.post("/api/query", response_model=QueryResponse)
async def process_query(
    query_request: QueryRequest,
    current_user: dict = Depends(get_current_user)
):
    """Process user query through chatbot"""
    try:
        result = chat_service.generate_response(query_request.query)
        return QueryResponse(
            response=result["response"],
            sources=result.get("sources", []),
            confidence=result.get("confidence"),
            session_id=query_request.session_id or "default"
        )
    except RuntimeError as e:
        logger.error(f"Bedrock query error: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Chat service is temporarily unavailable"
        )
    except Exception as e:
        logger.error(f"Query processing error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process query"
        )


@app.post("/api/query/stream")
async def process_query_stream(
    query_request: QueryRequest,
    current_user: dict = Depends(get_current_user)
):
    """Stream chatbot response chunks as server-sent events."""
    try:
        token_stream, sources, confidence = chat_service.stream_response(query_request.query)

        def event_stream():
            try:
                for token in token_stream:
                    data = {"type": "delta", "text": token}
                    yield f"data: {JSONResponse(content=data).body.decode('utf-8')}\n\n"

                done = {
                    "type": "done",
                    "sources": sources,
                    "confidence": confidence,
                    "session_id": query_request.session_id or "default",
                }
                yield f"data: {JSONResponse(content=done).body.decode('utf-8')}\n\n"
            except Exception as stream_error:
                err = {"type": "error", "message": str(stream_error)}
                yield f"data: {JSONResponse(content=err).body.decode('utf-8')}\n\n"

        return StreamingResponse(event_stream(), media_type="text/event-stream")
    except RuntimeError as e:
        logger.error(f"Bedrock streaming query error: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Chat service is temporarily unavailable"
        )
    except Exception as e:
        logger.error(f"Streaming query processing error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to stream query"
        )


# Report endpoints
@app.get("/api/reports")
async def get_reports(current_user: dict = Depends(get_current_user)):
    """Get list of generated reports for user's location"""
    try:
        reports = await report_service.list_reports(current_user)
        return {"reports": reports}
    except Exception as e:
        logger.error(f"Error getting reports: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get reports"
        )


@app.post("/api/reports/generate", response_model=ReportResponse)
async def generate_report(
    report_request: ReportGenerateRequest,
    current_user: dict = Depends(get_current_user)
):
    """Generate a new report"""
    try:
        return ReportResponse(
            report_id="legacy-placeholder",
            report_url="N/A",
            expires_at=datetime.utcnow().isoformat(),
            report_type=report_request.report_type,
        )
    except Exception as e:
        logger.error(f"Report generation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate report"
        )


@app.post("/api/reports/query")
async def generate_report_from_query(
    payload: dict,
    current_user: dict = Depends(get_current_user)
):
    """Generate and persist report from query builder inputs."""
    try:
        query = (payload.get("query") or "").strip()
        if not query:
            raise HTTPException(status_code=400, detail="Query is required")

        scheme_type_filter = (payload.get("scheme_type_filter") or "").strip().lower()
        top_k = int(payload.get("top_k") or 8)
        if top_k < 1 or top_k > 20:
            raise HTTPException(status_code=400, detail="top_k must be between 1 and 20")

        answer = await report_service.ask_question(
            query=query,
            scheme_type_filter=scheme_type_filter,
            top_k=top_k,
        )
        return answer
    except HTTPException:
        raise
    except RuntimeError as e:
        logger.error(f"Report Bedrock error: {e}")
        raise HTTPException(status_code=502, detail="Report service unavailable")
    except Exception as e:
        logger.error(f"Question query error: {e}")
        raise HTTPException(status_code=500, detail="Failed to run query")


@app.post("/api/reports/generate-standard")
async def generate_standard_report(
    payload: dict,
    current_user: dict = Depends(get_current_user)
):
    """Generate and persist report from dedicated 10 report questions."""
    try:
        topic = (payload.get("topic") or "").strip()
        if not topic:
            raise HTTPException(status_code=400, detail="Topic is required")

        scheme_type_filter = (payload.get("scheme_type_filter") or "").strip().lower()
        top_k = int(payload.get("top_k") or 8)
        if top_k < 1 or top_k > 20:
            raise HTTPException(status_code=400, detail="top_k must be between 1 and 20")

        report = await report_service.generate_report(
            topic=topic,
            current_user=current_user,
            scheme_type_filter=scheme_type_filter,
            top_k=top_k,
        )
        return report
    except HTTPException:
        raise
    except RuntimeError as e:
        logger.error(f"Standard report Bedrock error: {e}")
        raise HTTPException(status_code=502, detail="Report service unavailable")
    except Exception as e:
        logger.error(f"Standard report generation error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate report")


@app.get("/api/reports/{report_id}")
async def get_report_by_id(
    report_id: str,
    current_user: dict = Depends(get_current_user)
):
    try:
        report = await report_service.get_report(current_user, report_id)
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
        return report
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error loading report {report_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to load report")


@app.post("/api/reports/{report_id}/regenerate")
async def regenerate_report(
    report_id: str,
    current_user: dict = Depends(get_current_user)
):
    try:
        report = await report_service.regenerate_report(current_user, report_id)
        return report
    except ValueError:
        raise HTTPException(status_code=404, detail="Report not found")
    except RuntimeError as e:
        logger.error(f"Report regenerate Bedrock error: {e}")
        raise HTTPException(status_code=502, detail="Report service unavailable")
    except Exception as e:
        logger.error(f"Failed to regenerate report {report_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to regenerate report")


@app.get("/api/reports/{report_id}/download")
async def download_report(
    report_id: str,
    format: str = "txt",
    current_user: dict = Depends(get_current_user)
):
    try:
        report = await report_service.get_report(current_user, report_id)
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")

        fmt = format.lower().strip()
        if fmt not in {"txt", "pdf", "json"}:
            raise HTTPException(status_code=400, detail="format must be one of: txt, pdf, json")

        if fmt == "json":
            return JSONResponse(content=report)

        artifact_path = report_service.ensure_report_artifact(
            report_id=report_id,
            report_text=report.get("report_text", ""),
            file_format=fmt,
        )

        media_type = "text/plain" if fmt == "txt" else "application/pdf"
        filename = f"report-{report_id}.{fmt}"
        return FileResponse(path=artifact_path, media_type=media_type, filename=filename)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to download report {report_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to download report")


# Dashboard endpoints
@app.get("/api/dashboard/rainfall")
async def get_rainfall_data(current_user: dict = Depends(get_current_user)):
    """Get rainfall data for user's location"""
    try:
        # TODO: Implement rainfall data retrieval
        return {
            "location": f"{current_user.get('district', '')} - {current_user.get('mandal', '')}",
            "data": [],
            "last_updated": "2024-01-01T00:00:00Z"
        }
    except Exception as e:
        logger.error(f"Error getting rainfall data: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get rainfall data"
        )


@app.get("/api/dashboard/district")
async def get_district_data(current_user: dict = Depends(get_current_user)):
    """Get district-level statistics"""
    try:
        district = current_user.get("district", "")
        state = current_user.get("state", "telangana")
        
        # Get location hierarchy
        hierarchy = location_service.get_location_hierarchy(state, district)
        
        return {
            "district": district,
            "total_mandals": len(hierarchy.get("mandals", [])),
            "total_villages": 0,  # TODO: Calculate total villages
            "statistics": {}
        }
    except Exception as e:
        logger.error(f"Error getting district data: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get district data"
        )


# Schemes endpoints
@app.get("/api/schemes")
async def get_schemes(current_user: dict = Depends(get_current_user)):
    """Get available schemes"""
    try:
        # TODO: Implement scheme retrieval from RAG service
        return {"schemes": []}
    except Exception as e:
        logger.error(f"Error getting schemes: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get schemes"
        )


# File ingest endpoint (District Admin only)
@app.post("/api/ingest")
async def ingest_file(
    file: UploadFile = File(...),
    target_index: str = Form("schemes_index"),
    document_type: str = Form("official_guidelines"),
    scheme_name: str = Form(""),
    scheme_type: str = Form(""),
    ministry: str = Form(""),
    state_scope: str = Form("Central"),
    current_user: dict = Depends(require_persona([PersonaEnum.DISTRICT_ADMIN]))
):
    """Upload and ingest files (District Admin only)"""
    try:
        if not file.filename or not file.filename.lower().endswith(".pdf"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only PDF files are supported for ingestion"
            )

        allowed_indexes = {"schemes_index", "citizen_faq_index"}
        if target_index not in allowed_indexes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid target index"
            )

        content = await file.read()
        extracted_text = _extract_pdf_text(content)
        chunks = _chunk_text(extracted_text)

        if not chunks:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Could not extract text from PDF"
            )

        file_id = str(uuid4())
        documents = []
        for i, chunk in enumerate(chunks):
            documents.append({
                "id": f"{file_id}-{i}",
                "text": chunk,
                "metadata": {
                    "file_id": file_id,
                    "filename": file.filename,
                    "target_index": target_index,
                    "document_type": document_type,
                    "scheme_name": scheme_name,
                    "scheme_type": scheme_type,
                    "ministry": ministry,
                    "state_scope": state_scope,
                    "uploaded_by": current_user.get("gmail", ""),
                }
            })

        inserted = vector_store.add_documents(documents, collection_name=target_index)
        if not inserted:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to ingest document"
            )

        return {
            "file_id": file_id,
            "filename": file.filename,
            "status": "completed",
            "target_index": target_index,
            "chunks_ingested": len(chunks),
            "index_count": vector_store.count_documents(collection_name=target_index),
            "message": "Document ingested into local ChromaDB successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"File ingest error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to ingest file"
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG
    )
