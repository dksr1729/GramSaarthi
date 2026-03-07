from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from config import settings
from models import PersonaEnum
import logging

logger = logging.getLogger(__name__)

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# HTTP Bearer token
security = HTTPBearer()


def hash_password(password: str) -> str:
    """Hash a password"""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash"""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token"""
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(hours=settings.JWT_EXPIRATION_HOURS)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    
    return encoded_jwt


def decode_access_token(token: str) -> Optional[dict]:
    """Decode JWT access token"""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except JWTError as e:
        logger.error(f"JWT decode error: {e}")
        return None


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Get current user from JWT token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    token = credentials.credentials
    payload = decode_access_token(token)
    
    if payload is None:
        raise credentials_exception
    
    gmail: str = payload.get("gmail")
    if gmail is None:
        raise credentials_exception
    
    return payload


def require_persona(required_personas: list[PersonaEnum]):
    """Dependency to check if user has required persona"""
    async def persona_checker(current_user: dict = Depends(get_current_user)) -> dict:
        user_persona = current_user.get("persona")
        
        if user_persona not in [p.value for p in required_personas]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required persona: {[p.value for p in required_personas]}"
            )
        
        return current_user
    
    return persona_checker


def get_location_key(user: dict) -> str:
    """Generate location key from user data"""
    district = user.get("district", "")
    mandal = user.get("mandal", "")
    village = user.get("village", "")
    
    return f"{district}#{mandal}#{village}"


def check_location_access(user: dict, requested_location: dict) -> bool:
    """Check if user has access to requested location"""
    user_persona = user.get("persona")
    
    # District Admin can access all data in their district
    if user_persona == PersonaEnum.DISTRICT_ADMIN.value:
        return user.get("district") == requested_location.get("district")
    
    # Panchayat Officer can access their mandal and village
    if user_persona == PersonaEnum.PANCHAYAT_OFFICER.value:
        return (
            user.get("district") == requested_location.get("district") and
            user.get("mandal") == requested_location.get("mandal")
        )
    
    # Rural User can only access their village
    if user_persona == PersonaEnum.RURAL_USER.value:
        return (
            user.get("district") == requested_location.get("district") and
            user.get("mandal") == requested_location.get("mandal") and
            user.get("village") == requested_location.get("village")
        )
    
    return False
