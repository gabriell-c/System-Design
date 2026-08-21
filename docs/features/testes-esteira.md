# Ferramentas de teste — Archia

## Comandos

| Camada | Comando |
|--------|---------|
| Backend lint | `cd backend && ruff check app tests` |
| Backend testes | `cd backend && pytest tests -q` |
| Frontend lint/types | `cd web && pnpm exec eslint . --quiet && pnpm exec tsc --noEmit` |
| Frontend unit | `cd web && pnpm test` |
| Dep audit | `cd web && pnpm audit --prod` · `cd backend && pip_audit -r requirements.txt` |
| E2E + a11y + visual | `cd web && pnpm exec next build` (com `NEXT_PUBLIC_API_URL=http://127.0.0.1:8021`) + `pnpm test:e2e` |

## Playwright

- Config: `web/playwright.config.ts` (API `:8021`, web `:3021`)
- Usa `next start` (não `next dev`) para evitar lock de instância única do Next 16
- Snapshots: `web/e2e/**/*.png` — atualizar com `pnpm test:e2e:update`

## Gaps conscientes

- **Mutation testing (mutmut/stryker):** mutmut no Windows exige WSL; usamos `tests/test_mutation_guards.py` como guarda de mutações comuns. Instalar mutmut via WSL só se pedido.
- **k6 carga:** script em `backend/tests/load.js`; smoke de p95 em `tests/test_perf_smoke.py`.
- **npm audit:** o repo web usa **pnpm** (`pnpm-lock.yaml`); use `pnpm audit`, não `npm audit`.
- **CI:** ver `.github/workflows/ci.yml` (lint + pytest + eslint + tsc + build).
