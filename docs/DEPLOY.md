# Deploy — Archia (local-first)

Guia rápido para subir o editor no seu PC ou em um host Docker.

## Pré-requisitos

- Docker + Docker Compose **ou**
- Python 3.12 + Node.js 22 + pnpm 9

Portas padrão (não use 3000/8000):

| Serviço  | Porta |
|----------|-------|
| Backend  | 4410  |
| Frontend | 3015  |

## Docker Compose (recomendado)

Na raiz de `system_design/`:

```bash
docker compose up --build
```

- UI: http://localhost:3015  
- API: http://localhost:4410/api/health  
- Login seed: `SENIOR` / `CHANGEPASSWORD` (troque após o primeiro acesso)

Variáveis úteis (compose / `.env`):

| Variável | Descrição |
|----------|-----------|
| `ARCHIA_JWT_SECRET` | Segredo JWT (≥ 32 bytes) |
| `CORS_ORIGINS` | Origens permitidas (ex.: `http://localhost:3015`) |
| `DATABASE_URL` | Default SQLite em `./data/app.db` |
| `NEXT_PUBLIC_API_URL` | URL da API vista pelo browser |

## Desenvolvimento local (sem Docker)

### Backend

```bash
cd backend
python -m venv venv
# Windows: .\venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 4410
```

### Frontend

```bash
cd web
pnpm install
pnpm dev --port 3015
```

Defina `NEXT_PUBLIC_API_URL=http://localhost:4410` se necessário.

## Checklist pós-deploy

1. `GET /api/health` → `{"status":"ok"}`
2. Login com SENIOR e troca de senha
3. Criar projeto / grafo e salvar
4. Exportar JSON e reimportar (checksum)
5. Simular offline: indicador “offline” na TopBar e rascunho em localStorage

## Rollback

- Compose: `docker compose down` e suba a tag/imagem anterior
- Volume SQLite: faça backup de `backend/data/app.db` antes de migrar

Ver também: [OPS.md](./OPS.md)
