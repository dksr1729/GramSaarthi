from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
