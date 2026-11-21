import os
from typing import Any
from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path
from pydantic import BaseModel

_backend_dir = Path(__file__).parent.parent.parent
# ENV_FILE can be set to switch between configurations, e.g.:
#   ENV_FILE=.env.cloud uv run langgraph dev
_env_file = os.getenv("ENV_FILE", str(_backend_dir / ".env.local"))


class QdrantConfig(BaseModel):
    url: str
    api_key: str
    vector_size: int
    collection: str
    distance: str
    output_dir: str

class CeleryConfig(BaseModel):
    broker_url: str
    result_backend: str

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_env_file,
        env_file_encoding="utf-8",
        extra="ignore",
        validate_assignment=True,
        case_sensitive=False
    )
    # Logging configuration
    LOG_LEVEL: str = "INFO"  # DEBUG, INFO, WARNING, ERROR, CRITICAL

    # API keys and tracing vars — declared here so pydantic-settings reads them
    # from the env file; model_post_init then writes them back to os.environ so
    # that LangChain, OpenAI SDK, and other libraries that read os.environ
    # directly pick them up regardless of how the process was started.
    OPENAI_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    TAVILY_API_KEY: str = ""

    # LangSmith tracing (optional)
    LANGCHAIN_TRACING_V2: str = ""
    LANGCHAIN_API_KEY: str = ""
    LANGCHAIN_PROJECT: str = ""
    LANGCHAIN_ENDPOINT: str = ""

    EMBEDDING_MODEL_NAME: str = "models/gemini-embedding-001"

    SUPERVISOR_MODEL_NAME: str = "google_genai:gemini-3-flash-preview"
    PF_AGENT_MODEL_NAME: str = "google_genai:gemini-3.5-flash-lite"
    PF_FILTER_MODEL_NAME: str = "google_genai:gemini-3.5-flash-lite"
    QA_AGENT_MODEL_NAME: str = "google_genai:gemini-3.5-flash-lite"
    QA_EVALUATION_MODEL_NAME: str = "google_genai:gemini-3.5-flash-lite"
    QA_EVALUATOR_MODEL_NAME: str = "google_genai:gemini-3-flash-preview"
    QA_BASELINE_MODEL_NAME: str = "google_genai:gemini-3.5-flash-lite"

    COHERE_API_KEY: str = ""

    PDF_DOWNLOAD_DIR: str = "./papers"

    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_API_KEY: str = ""
    QDRANT_VECTOR_SIZE: int = 3072
    QDRANT_COLLECTION: str = "papers"
    QDRANT_DISTANCE: str = "COSINE"

    S2_API_KEY: str = ""

    REDIS_URL: str = "redis://localhost:6379/0"

    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"

    GROBID_SERVER_URL: str = "http://localhost:8070"

    GOOGLE_JWKS_URL: str = "https://www.googleapis.com/oauth2/v3/certs"
    DISABLE_AUTH: bool = False

    def model_post_init(self, __context: Any) -> None:
        """Push API keys and tracing vars into os.environ so LangChain/OpenAI SDKs can find them."""
        for key in (
            "OPENAI_API_KEY",
            "GEMINI_API_KEY",
            "TAVILY_API_KEY",
            "LANGCHAIN_TRACING_V2",
            "LANGCHAIN_API_KEY",
            "LANGCHAIN_PROJECT",
            "LANGCHAIN_ENDPOINT",
        ):
            value = getattr(self, key, "")
            if value:
                os.environ.setdefault(key, value)

    @property
    def qdrant_config(self) -> QdrantConfig:
        return QdrantConfig(
            url=self.QDRANT_URL,
            api_key=self.QDRANT_API_KEY,
            vector_size=self.QDRANT_VECTOR_SIZE,
            collection=self.QDRANT_COLLECTION,
            distance=self.QDRANT_DISTANCE,
            output_dir=self.PDF_DOWNLOAD_DIR,
        )

    @property
    def celery_config(self) -> CeleryConfig:
        return CeleryConfig(
            broker_url=self.CELERY_BROKER_URL,
            result_backend=self.CELERY_RESULT_BACKEND,
        )

settings = Settings()
