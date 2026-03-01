from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "GramSaarthi API"
    api_v1_prefix: str = "/api"
    allowed_origins: str = "http://localhost:5173"

    aws_region: str = "ap-south-1"
    ddb_users_table: str = "gramsaarthi_users"

    jwt_secret: str = "change-this-secret-in-env"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
