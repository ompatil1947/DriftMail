"""
Central place that reads .env into typed settings. Everything OAuth/Gmail
related pulls its config from here instead of calling os.getenv() directly,
so a missing/misnamed env var fails loudly at startup with a clear pydantic
error instead of silently returning None deep inside a request handler.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    google_client_id: str
    google_client_secret: str
    google_redirect_uri: str
    frontend_url: str = ""
    gemini_api_key: str = ""  # Required for RAG "Ask about this email" feature

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
