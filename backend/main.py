from fastapi import FastAPI, HTTPException, Depends, status, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from config import settings
from models import (
    UserRegister, UserLogin, TokenResponse, QueryRequest, QueryResponse,
    ReportGenerateRequest, ReportResponse, SchemeResponse, PersonaEnum
)
from services.auth_service import auth_service
from services.location_service import location_service
from auth import get_current_user, require_persona
import logging
from typing import List

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

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
        # TODO: Implement chatbot service
        return QueryResponse(
            response="This is a placeholder response. Chatbot service will be implemented.",
            sources=["System"],
            confidence=0.8,
            session_id=query_request.session_id or "default"
        )
    except Exception as e:
        logger.error(f"Query processing error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process query"
        )


# Report endpoints
@app.get("/api/reports")
async def get_reports(current_user: dict = Depends(get_current_user)):
    """Get list of generated reports for user's location"""
    try:
        # TODO: Implement report listing
        return {"reports": []}
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
        # TODO: Implement report generation
        return ReportResponse(
            report_id="placeholder",
            report_url="https://example.com/report.pdf",
            expires_at="2024-12-31T23:59:59Z",
            report_type=report_request.report_type
        )
    except Exception as e:
        logger.error(f"Report generation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate report"
        )


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
    current_user: dict = Depends(require_persona([PersonaEnum.DISTRICT_ADMIN]))
):
    """Upload and ingest files (District Admin only)"""
    try:
        # TODO: Implement file ingestion
        return {
            "file_id": "placeholder",
            "filename": file.filename,
            "status": "processing",
            "message": "File uploaded successfully"
        }
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
