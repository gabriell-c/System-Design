# Comparador e revisão humana

- Página `/compare`: importa dois JSON e chama `POST /api/v1/compare`.
- Perfil **dev sênior**: análise basta.
- Perfil **outro**: `POST /api/v1/graphs/{id}/review` com comentário obrigatório (≥8 chars) e status approved/rejected/pending_review.
