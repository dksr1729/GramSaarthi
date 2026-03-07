from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class PersonaEnum(str, Enum):
    DISTRICT_ADMIN = "District Admin"
    PANCHAYAT_OFFICER = "Panchayat Officer"
    RURAL_USER = "Rural User"


class UserRegister(BaseModel):
    gmail: EmailStr
    password: str = Field(..., min_length=6)
    name: str = Field(..., min_length=2)
    persona: PersonaEnum
    state: str
    district: Optional[str] = None
    mandal: Optional[str] = None
    village: Optional[str] = None


class UserLogin(BaseModel):
    gmail: EmailStr
    password: str


class UserResponse(BaseModel):
    gmail: str
    name: str
    persona: str
    state: str
    district: Optional[str] = None
    mandal: Optional[str] = None
    village: Optional[str] = None
    created_at: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class QueryRequest(BaseModel):
    query: str
    session_id: Optional[str] = None


class QueryResponse(BaseModel):
    response: str
    sources: List[str] = []
    confidence: Optional[float] = None
    session_id: str


class ReportGenerateRequest(BaseModel):
    report_type: str = Field(..., pattern="^(monthly|quarterly|annual)$")
    start_date: str
    end_date: str


class ReportResponse(BaseModel):
    report_id: str
    report_url: str
    expires_at: str
    report_type: str


class SchemeResponse(BaseModel):
    scheme_id: str
    name: str
    description: str
    eligibility: str
    application_process: str
    deadline: Optional[str] = None
    source: str
    last_updated: str
    category: Optional[str] = None


class DashboardRainfallResponse(BaseModel):
    location: str
    data: List[Dict[str, Any]]
    last_updated: str


class DashboardDistrictResponse(BaseModel):
    district: str
    total_mandals: int
    total_villages: int
    statistics: Dict[str, Any]


class FileIngestRequest(BaseModel):
    file_type: str
    description: Optional[str] = None


class FileIngestResponse(BaseModel):
    file_id: str
    filename: str
    status: str
    message: str


class LocationState(BaseModel):
    name: str
    districts: List[str]


class LocationMandal(BaseModel):
    name: str
    villages: List[str]
