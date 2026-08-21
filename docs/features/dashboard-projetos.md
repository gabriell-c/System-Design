# Dashboard e projetos

## O que faz

A home (`/`) é o **Dashboard de projetos**: grid com busca, ordenação (recentes / mais pesados / nome), filtro ativos vs arquivados e fixados primeiro.

Cada card abre o **editor de produção** em `/project/<id>`. Criação de projeto inclui nome, descrição, visibilidade (público/privado) e lista de acesso por e-mail (`read` | `full`).

## Rotas

| Rota | Função |
|------|--------|
| `GET /` | Dashboard |
| `/project/[id]` | Editor (EditorShell) do projeto |
| `/graphs/[id]` | Compat: redireciona para `/project/<project_id>` |

## API (`/api/v1/projects`)

| Método | Path | Função |
|--------|------|--------|
| GET | `/` | Lista com `search`, `sort_by`, `archived`, `pinned_first` |
| POST | `/` | Cria projeto + diagramas tipados + ACL |
| GET/PUT/DELETE | `/{id}` | CRUD |
| PATCH | `/{id}/archive` | Alterna arquivado |
| PATCH | `/{id}/pin` | Alterna fixado |
| GET | `/{id}/share-url` | URL de compartilhamento (exige `is_public`) |

## Modelo

Campos novos em `projects`: `description`, `is_public`, `archived`, `pinned`, `share_token`.

Tabela `project_access`: `email` + `role` (`read` \| `full`).

Migração: `alembic/versions/0002_project_fields.py`.

## Frontend

- Componentes: `web/src/components/dashboard/*`
- Store: `web/src/lib/project-store.ts`
- API client: `web/src/lib/api.ts`
