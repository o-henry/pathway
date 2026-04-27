from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = Field(default="development", alias="APP_ENV")
    data_dir: Path = Field(default=Path("./data"), alias="LIFEMAP_DATA_DIR")
    sqlite_url: str = Field(default="sqlite:///./data/local.db", alias="LIFEMAP_SQLITE_URL")
    llm_provider: str = Field(default="codex", alias="LIFEMAP_LLM_PROVIDER")
    llm_request_timeout_seconds: float = Field(
        default=180.0, alias="LIFEMAP_LLM_REQUEST_TIMEOUT_SECONDS"
    )
    graph_generation_timeout_seconds: float = Field(
        default=0.0, alias="LIFEMAP_GRAPH_GENERATION_TIMEOUT_SECONDS"
    )
    llm_max_repair_attempts: int = Field(default=2, alias="LIFEMAP_LLM_MAX_REPAIR_ATTEMPTS")
    generation_query_limit: int = Field(default=10, alias="LIFEMAP_GENERATION_QUERY_LIMIT")
    generation_hits_per_query: int = Field(
        default=4, alias="LIFEMAP_GENERATION_HITS_PER_QUERY"
    )
    generation_evidence_limit: int = Field(
        default=18, alias="LIFEMAP_GENERATION_EVIDENCE_LIMIT"
    )
    lancedb_uri: str = Field(default="./data/lancedb", alias="LIFEMAP_LANCEDB_URI")
    source_chunk_target_tokens: int = Field(default=700, alias="SOURCE_CHUNK_TARGET_TOKENS")
    source_chunk_overlap_tokens: int = Field(default=120, alias="SOURCE_CHUNK_OVERLAP_TOKENS")
    codex_model: str = Field(default="gpt-5.5", alias="LIFEMAP_CODEX_MODEL")
    codex_web_search_enabled: bool = Field(default=True, alias="LIFEMAP_CODEX_WEB_SEARCH_ENABLED")
    local_api_token: str | None = Field(default=None, alias="LIFEMAP_LOCAL_API_TOKEN")
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
    if settings.lancedb_uri.startswith("./"):
        lancedb_path = Path(settings.lancedb_uri)
        lancedb_path.parent.mkdir(parents=True, exist_ok=True)
    else:
        Path(settings.lancedb_uri).mkdir(parents=True, exist_ok=True)
    return settings
