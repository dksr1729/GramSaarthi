from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "GramSaarthi API"
    api_v1_prefix: str = "/api"
    allowed_origins: str = "http://localhost:5173"
    aws_region: str = "ap-south-1"
    dynamodb_users_table: str = "gramsaarthi_users"
    dynamodb_users_pk_name: str = "role"
    dynamodb_users_sk_name: str = "login_id"
    bedrock_nova_model_id: str = "amazon.nova-lite-v1:0"
    bedrock_inference_profile_id: str = ""
    bedrock_max_tokens: int = 512
    bedrock_temperature: float = 0.2
    bedrock_embedding_model_id: str = "amazon.titan-embed-text-v2:0"
    aoss_endpoint: str = ""
    aoss_index_name: str = "gramsaarthi_chunks"
    aoss_vector_field: str = "embedding"
    ingestion_chunk_size: int = 1200
    ingestion_chunk_overlap: int = 200
    rag_top_k: int = 6
    rag_max_context_chars: int = 6000

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]

    @property
    def bedrock_model_identifier(self) -> str:
        profile_id = self.bedrock_inference_profile_id.strip()
        return profile_id if profile_id else self.bedrock_nova_model_id


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
