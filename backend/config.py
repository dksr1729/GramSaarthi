from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # Application Settings
    APP_NAME: str = "GramSaarthi"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24

    # AWS Settings
    AWS_REGION: str = "ap-south-1"
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_SESSION_TOKEN: str = ""
    AWS_PROFILE: str = ""

    # Optional endpoint override (leave empty for AWS DynamoDB)
    DYNAMODB_ENDPOINT_URL: str = ""

    # DynamoDB Tables
    DYNAMODB_USERS_TABLE: str = "gramsaarthi-users-dev"
    DYNAMODB_FORECASTS_TABLE: str = "gramsaarthi-forecasts-dev"
    DYNAMODB_SCHEMES_TABLE: str = "gramsaarthi-schemes-dev"
    DYNAMODB_REPORTS_TABLE: str = "gramsaarthi-reports-dev"
    DYNAMODB_CHAT_SESSIONS_TABLE: str = "gramsaarthi-chat-sessions-dev"

    # S3 Buckets
    S3_DATA_BUCKET: str = "gramsaarthi-data-dev"
    S3_REPORTS_BUCKET: str = "gramsaarthi-reports-dev"
    S3_SCHEMES_BUCKET: str = "gramsaarthi-schemes-dev"
    S3_SCHEMES_PREFIX: str = "schemes"

    # Bedrock Settings
    BEDROCK_MODEL_ID: str = "amazon.nova-lite-v1:0"
    BEDROCK_INFERENCE_PROFILE_ID: str = "apac.amazon.nova-lite-v1:0"
    BEDROCK_EMBEDDING_MODEL_ID: str = "amazon.titan-embed-text-v1"
    BEDROCK_MAX_TOKENS: int = 512
    BEDROCK_TEMPERATURE: float = 0.2

    # ChromaDB Settings
    CHROMA_PERSIST_DIRECTORY: str = "./chroma_db"
    CHROMA_COLLECTION_NAME: str = "schemes"

    # CORS Settings
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    # Server Settings
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    class Config:
        env_file = ".env"
        case_sensitive = True

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls,
        init_settings,
        env_settings,
        dotenv_settings,
        file_secret_settings,
    ):
        # Prefer project .env values over host-level shell variables.
        return init_settings, dotenv_settings, env_settings, file_secret_settings

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]


settings = Settings()
