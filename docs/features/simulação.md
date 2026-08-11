# Simulação de carga, jornada e eventos

Estima se a arquitetura desenhada no canvas aguenta cenários de uso — **sem** disparar HTTP real. Usa heurísticas de throughput (`THROUGHPUT_RPS`), cache, LB e DB + seed para reprodutibilidade.

## O que cobre

| Pilar | O que faz |
|---|---|
| Cenários de carga | spike, constant, gradual, periodic — timeline RPS / erro / p95 / saturação |
| Jornadas | funil com drop-off por etapa (landing → pagamento etc.) |
| Eventos | probabilidade + cascata (ex.: timeout de pagamento → retry storm) |
| Validação | seed fixa, realism score, regras min/max, export CSV / Prometheus |

## Endpoints

- `GET /api/v1/simulations/presets`
- `GET /api/v1/simulations/presets/{id}`
- `POST /api/v1/simulations/run` — body `SimulationRequest`
- `POST /api/v1/simulations/run-preset` — `{ preset_id, nodes, edges, seed, realism_level }`

Presets embutidos: `black-friday-spike`, `steady-saas`, `incident-cascade`, `gradual-ramp`.

## UI

Aba **Sim** no inspetor direito (`SimulationPanel` + `useSimulation`). Seed e realismo persistem em `localStorage`.

## Código

- Backend: `app/schemas/simulation.py`, `app/services/simulation.py`, `app/routes/simulations.py`
- Frontend: `web/src/lib/simulation.ts`, `web/src/hooks/useSimulation.ts`, `web/src/components/panels/SimulationPanel.tsx`
- Testes: `backend/tests/test_simulations.py`
