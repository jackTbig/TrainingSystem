from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    APP_NAME: str = "TrainingSystem"
    APP_ENV: str = "development"
    DEBUG: bool = True

    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 120
    ALGORITHM: str = "HS256"

    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/training_db"

    REDIS_URL: str = "redis://localhost:6379/0"

    RABBITMQ_URL: str = "amqp://guest:guest@localhost:5672/"

    STORAGE_TYPE: str = "local"
    STORAGE_LOCAL_PATH: str = "./uploads"

    AI_API_BASE_URL: str = "https://api.openai.com/v1"
    AI_API_KEY: str = ""
    AI_MODEL_NAME: str = "gpt-4o"


settings = Settings()
