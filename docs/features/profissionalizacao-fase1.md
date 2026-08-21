# Profissionalização — Fase 1

## O que mudou

| Pilar | Entrega |
|-------|---------|
| CI/CD | [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) — lint, pytest, eslint, tsc, unit, next build |
| Banco | Alembic (`backend/alembic/`) + Postgres no `docker-compose.yml`; SQLite continua no dev/test |
| Secrets | `.env.example` (root + backend + web); `.env` no `.gitignore` |
| Logs | JSON estruturado + `X-Request-ID` (`app/logging_config.py`) |
| API | Rotas canônicas sob `/api/v1/...`; paths legados reescritos com header `Deprecation` |

## Comandos

```bash
# Migrações (Postgres / SQLite file)
cd backend && alembic upgrade head

# Dev local (SQLite)
uvicorn app.main:app --reload --port 8001

# Docker stack (Postgres + API + Web)
docker compose up --build
```

## Variáveis críticas

- `DATABASE_URL` — `sqlite:///./data/app.db` ou `postgresql+psycopg2://...`
- `ARCHIA_JWT_SECRET` — obrigatório em produção (≥32 chars)
- `LOG_JSON` — `true` (default) para logs estruturados
- `ARCHIA_ENV` — `development` | `production`

## Compatibilidade

Paths antigos (`/auth`, `/projects`, `/profile`, `/users`, `/graphs/.../comments`) ainda funcionam via middleware de rewrite e retornam:

- `Deprecation: true`
- `Link: </api/v1>; rel="successor-version"`
- `Sunset: Sat, 01 Aug 2027 00:00:00 GMT`

Clientes novos devem usar apenas `/api/v1/...`.
