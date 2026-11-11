from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Archia API"
    database_url: str = "sqlite:///./data/app.db"
    cors_origins: str = "http://localhost:3015,http://127.0.0.1:3015,http://localhost:3017,http://127.0.0.1:3017"
    omniroute_base_url: str = "http://localhost:20128/v1"
    omniroute_api_key: str = "local"
    omniroute_model: str = "auto/coding"
    omniroute_timeout_s: float = 45.0
    log_level: str = "INFO"
    log_json: bool = True
    archia_env: str = "development"
    archia_jwt_secret: str = "archia-secret-key-change-in-production"
    # P1.5 — chave (secreta) de cifra em repouso para segredos (ai_settings.api_key).
    # Vazio em dev => fallback de chave insegura + warning; em produção DEVE ser definido.
    archia_encryption_secret: str = ""

    @property
    def origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        return self.archia_env.lower() == "production"

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")


settings = Settings()
