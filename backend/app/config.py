from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Archia API"
    database_url: str = "sqlite:///./data/app.db"
    cors_origins: str = "http://localhost:3015,http://127.0.0.1:3015"
    omniroute_base_url: str = "http://localhost:20128/v1"
    omniroute_api_key: str = "local"
    omniroute_model: str = "auto/coding"
    omniroute_timeout_s: float = 45.0
    log_level: str = "INFO"

    @property
    def origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
