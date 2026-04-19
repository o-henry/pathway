from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = Field(default="development", alias="APP_ENV")
    data_dir: Path = Field(default=Path("./data"), alias="LIFEMAP_DATA_DIR")
    sqlite_url: str = Field(default="sqlite:///./data/local.db", alias="LIFEMAP_SQLITE_URL")
    llm_provider: str = Field(default="ollama", alias="LIFEMAP_LLM_PROVIDER")
    llm_request_timeout_seconds: float = Field(
        default=60.0, alias="LIFEMAP_LLM_REQUEST_TIMEOUT_SECONDS"
    )
    llm_max_repair_attempts: int = Field(default=2, alias="LIFEMAP_LLM_MAX_REPAIR_ATTEMPTS")
    ollama_base_url: str = Field(default="http://localhost:11434", alias="OLLAMA_BASE_URL")
    ollama_llm_model: str = Field(default="llama3.1", alias="OLLAMA_LLM_MODEL")
    ollama_embedding_model: str = Field(
        default="nomic-embed-text", alias="OLLAMA_EMBEDDING_MODEL"
    )
    openai_base_url: str = Field(default="https://api.openai.com/v1", alias="OPENAI_BASE_URL")
    openai_api_key: str = Field(default="", alias="OPENAI_API_KEY")
    openai_model: str = Field(default="", alias="OPENAI_MODEL")
    source_fetch_enabled: bool = Field(default=False, alias="SOURCE_FETCH_ENABLED")
    source_fetch_rate_limit_per_minute: int = Field(
        default=10, alias="SOURCE_FETCH_RATE_LIMIT_PER_MINUTE"
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    settings = Settings()
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    return settings
