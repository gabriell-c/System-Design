# Resiliência (P0.5)

## O que faz

- **Injeção de falha** no nó selecionado (`POST /api/v1/graphs/{id}/failure-injection`)
- **Blast radius** com highlight no canvas (`POST /api/v1/graphs/{id}/blast-radius`)
- **Circuit breakers** no grafo (`GET /api/v1/graphs/{id}/circuit-breakers`)
- **Cost model** por serviço/região (`GET /api/v1/graphs/{id}/cost-estimate`)
- **Wiki viva** com âncoras estáveis (`GET /api/v1/graphs/{id}/doc`)

## UI

- Painel **Falha** no inspetor (`ResiliencePanel`)
- Painéis **Custos** e **Wiki** em Mais
- Nós `circuitBreaker` e `securityGroup` ao soltar `pat-circuit-breaker` / `sec-sg`

## Serviços backend

- `backend/app/services/failure_injection.py`
- `backend/app/services/blast_radius.py`
- `backend/app/services/circuit_breaker.py`
- `backend/app/services/cost_model.py`
- `backend/app/services/live_doc.py`
