# Operações — Archia

Runbook curto para operação local-first / single-host.

## Health checks

| Alvo | Endpoint / comando |
|------|--------------------|
| API | `GET http://localhost:4410/api/health` |
| Docker backend | `HEALTHCHECK` no `backend/Dockerfile` (urllib → `/api/health`) |
| Docker web | `HEALTHCHECK` no `web/Dockerfile` (wget → `/`) |

Compose deve marcar o serviço unhealthy se o healthcheck falhar 3×.

## Logs

- Backend: JSON quando `LOG_JSON=true` (padrão no container)
- Correlation: header `X-Request-ID` ecoado nas respostas

```bash
docker compose logs -f backend
docker compose logs -f web
```

## Backup / restore (SQLite)

```bash
# backup
cp backend/data/app.db "backend/data/app.db.bak-$(date +%Y%m%d)"

# restore (com containers parados)
cp backend/data/app.db.bak-YYYYMMDD backend/data/app.db
```

Para Postgres, use `pg_dump` / `pg_restore` e ajuste `DATABASE_URL`.

## Rate limits (em memória)

| Endpoint | Limite |
|----------|--------|
| Login | 5 / 60s / IP+user |
| Recover | 3 / 300s / IP+user |
| Analyze / compare | 10 / 60s / IP+user |
| Simulation | 5 / 60s / IP+user |

Reinício do processo zera os contadores. Em multi-réplica, troque por Redis se necessário.

## Auth / sessão

- Cookie HttpOnly `archia_session` (browser)
- Bearer JWT opcional (API / testes) — tem prioridade sobre o cookie quando presente
- Não persista JWT em `localStorage`

## Embeds públicos

- `GET /api/v1/embed/{graph_id}` só para grafos órfãos ou projetos com `is_public=true`
- Geração de snippet (`/token`) exige autenticação

## Incidentes comuns

| Sintoma | Ação |
|---------|------|
| CORS no browser | Conferir `CORS_ORIGINS` e porta 3015 |
| 401 em tudo | Cookie bloqueado (HTTPS/`Secure`) ou JWT inválido |
| Auto-save falha | TopBar mostra “sync erro” / “offline”; rascunho em `archia-draft` |
| 429 em analyze | Aguardar janela de 60s ou reiniciar API (dev) |
| DB locked (SQLite) | Um writer por vez; evitar múltiplos workers Uvicorn |

## Segurança mínima

1. Trocar senha do SENIOR
2. Definir `ARCHIA_JWT_SECRET` forte
3. Em produção: `ARCHIA_ENV=production` (cookie `Secure`)
4. Não expor a API sem TLS em redes não confiáveis

Ver também: [DEPLOY.md](./DEPLOY.md), [PLANO-MELHORIAS-LOCAL-FIRST.md](./PLANO-MELHORIAS-LOCAL-FIRST.md)
