import secrets

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    ENVIRONMENT: str = "development"
    DATABASE_URL: str = "mysql+pymysql://root@127.0.0.1:3306/ram_store"
    SECRET_KEY: str | None = None
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    CORS_ORIGINS: str = "http://localhost:5173"
    MAX_REQUEST_SIZE_BYTES: int = 1_048_576
    LOG_LEVEL: str = "INFO"
    LOG_REQUESTS: bool = True

    @model_validator(mode="after")
    def validate_security_settings(self) -> "Settings":
        env = self.ENVIRONMENT.strip().lower()
        if env in {"production", "prod", "staging"} and not self.SECRET_KEY:
            raise ValueError("SECRET_KEY must be set in production/staging environments")

        if not self.SECRET_KEY:
            # Development fallback only; production/staging must provide SECRET_KEY explicitly.
            self.SECRET_KEY = secrets.token_urlsafe(32)

        return self

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


settings = Settings()
