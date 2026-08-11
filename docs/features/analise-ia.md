# Análise por IA

`POST /api/v1/analyze` (e `POST /api/v1/graphs/{id}/analyze`):

1. Roda heurística local (benchmarks/ordens de grandeza em `app/services/knowledge.py`).
2. Dispara 4 agentes em paralelo via OmniRoute (`auto/coding` por padrão).
3. Consolidador tenta unificar; se a IA falhar, devolve só a heurística com `ia_ok=false`.

Toda métrica quantitativa carrega `is_estimate: true` e a UI mostra badge **estimativa**.

Reanálise automática: debounce de 2s no editor quando muda estrutura (não posição nem score).

Simulação de crescimento: small (~1k), medium (~100k), large (1M+).
