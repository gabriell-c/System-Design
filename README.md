<p align="center">
  <img src="https://img.shields.io/badge/status-100%25_confian%C3%A7a_arquitetural-3fb950?style=for-the-badge" alt="Status">
  <img src="https://img.shields.io/badge/tests-257_passed-3fb950?style=for-the-badge&logo=pytest&logoColor=white" alt="Tests">
  <img src="https://img.shields.io/badge/gaps-53%2F53_Feito-3fb950?style=for-the-badge" alt="Gaps">
  <img src="https://img.shields.io/badge/Python-3.12-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python">
  <img src="https://img.shields.io/badge/FastAPI-0.141-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI">
  <img src="https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Tailwind%20CSS-v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind">
  <img src="https://img.shields.io/badge/SQLite%2FPostgreSQL-4479A1?style=for-the-badge&logo=sqlite&logoColor=white" alt="Banco de dados">
  <img src="https://img.shields.io/badge/JWT%20Auth-000000?style=for-the-badge&logo=json-web-tokens&logoColor=white" alt="JWT Auth">
</p>

# 🏗️ Archia — Editor Visual de System Design com IA

**Desenhe, analise e simule arquiteturas de software reais** (zonas VPC/AZ, fluxos tipados multi-cloud) **e stacks** em um canvas visual — com avaliação no nível de um Software Architect.

O **Archia** é um SaaS que permite modelar arquiteturas de sistemas (componentes + conexões) arrastando e soltando blocos em um canvas, e recebe em troca uma **análise completa**: over/under-engineering, gargalos, riscos de segurança, custo mensal estimado e nota justificada. Tudo isso combinando **IA** (via OmniRoute/OpenAI/Anthropic) com **heurísticas locais determinísticas** que funcionam mesmo sem conexão com provedores de IA.

> 💡 **Caso de uso principal:** arquitetos e devs seniores usam o Archia para validar uma proposta de stack antes de escrever código — o editor entrega recomendações, compara alternativas lado a lado e simula o comportamento da arquitetura sob carga.

> ✅ **Status:** 100% de confiança arquitetural atingido (53/53 gaps P0-P3 fechados, 257 testes passando). Ver [`docs/GAPS-POR-PRIORIDADE.md`](docs/GAPS-POR-PRIORIDADE.md).

---

## 📑 Sumário

1. [Sobre o projeto](#-sobre-o-projeto)
2. [Stack tecnológica](#-stack-tecnológica)
3. [Funcionalidades](#-funcionalidades)
4. [Pré-requisitos](#-pré-requisitos)
5. [Instalação](#-instalação)
6. [Variáveis de ambiente](#-variáveis-de-ambiente)
7. [Executando o projeto](#-executando-o-projeto)
8. [Credenciais padrão](#-credenciais-padrão)
9. [Referência de endpoints da API](#-referência-de-endpoints-da-api)
10. [Estrutura do projeto](#-estrutura-do-projeto)
11. [Segurança](#-segurança)
12. [Testes](#-testes)
13. [Contribuição](#-contribuição)

---

## 🎯 Sobre o projeto

O Archia nasce do problema recorrente em equipes de engenharia: **avaliar se uma arquitetura proposta é adequada** antes de investir semanas de desenvolvimento. Em vez de depender exclusivamente de revisão manual (e cara), o Archia automatiza boa parte dessa avaliação:

- 🖼️ **Canvas visual** com componentes de domínio (Frontend, Backend, Dados, Infra, Mensageria, Identidade, Observabilidade, Integrações), conexões e **snap alignment** com guias.
- 📚 **Catálogo com 100+ tecnologias** organizadas por categoria, com heurísticas reais (throughput, custo, cache, limitações).
- 🤖 **Análise por IA** com fallback heurístico determinístico — a análise nunca fica "no ar" por falta de API key.
- ⚙️ **Motor de simulação** determinístico (carga, jornada de usuário e eventos) com presets prontos.
- 📤 **Exportação** para JSON, PNG, PDF e Markdown.
- 🔐 **Autenticação JWT** com cookies de sessão, remember-me, recuperação de senha por telefone + data de nascimento, e roles `user`/`senior`.

---

## 🛠️ Stack tecnológica

| Camada | Tecnologia | Detalhes |
|---|---|---|
| **Frontend** | Next.js 16 · React 19 · TypeScript 5 | App Router, renderização no cliente para o editor |
| | Tailwind CSS v4 · lucide-react · react-icons | Estilização e iconografia |
| | @xyflow/react (React Flow 12) | Canvas e grafo interativo |
| | Zustand 5 | Estado global (auth, grafo, histórico) |
| | html-to-image · swiper | Exportação de imagem e carrosséis |
| **Backend** | Python 3.12 · FastAPI 0.141 | API REST assíncrona |
| | SQLAlchemy 2.0 · SQLite / PostgreSQL | ORM e persistência |
| | Pydantic v2 · pydantic-settings | Validação e configuração |
| | bcrypt 5 · PyJWT 2.13 | Hash de senha e tokens JWT (HS256) |
| | httpx | Cliente HTTP (IA e teste de conectividade) |
| **IA** | OmniRoute (`auto/coding`) · OpenAI · Anthropic | Análise de arquitetura (configurável em runtime) |
| | Heurística local | Fallback determinístico sem IA |
| **Portas** | Backend `4410` · Frontend `3015` · OmniRoute `20128` | Execução local |

> 📄 Documentação detalhada do projeto em [`docs/README.md`](docs/README.md).  
> 📐 Padrão de diagrama review-ready: [`docs/PADRAO-DIAGRAMA-ARQUITETURA.md`](docs/PADRAO-DIAGRAMA-ARQUITETURA.md).

## ✨ Funcionalidades

### 🖼️ Editor visual de canvas

- Arraste e solte **blocos de domínio** e **cards de tecnologia** diretamente no canvas.
- Conexões entre componentes com `@xyflow/react`, handles de ancoragem e roteamento.
- **Snap alignment**: guias visuais de alinhamento/centralização enquanto arrasta.
- **Undo/redo** com painel de histórico (`HistoryPanel`).
- **Auto-save** configurável por usuário (desligado, 5, 15, 30 ou 60 minutos).
- **Modo tela cheia** para foco total no diagrama.
- Templates prontos para começar rápido (`templates.ts`): MVP barato, SaaS B2B, Marketplace, API interna, Landing page, App mobile, Microserviços.

### 🗂️ Paleta de componentes e catálogo

- **Paleta por domínio**: Frontend, Backend, Dados, Infra, Identidade, Observabilidade, Integrações (inclui filas/messaging) e Deploy.
- **Catálogo com 100+ tecnologias** (`catalog.ts`), cada uma com heurísticas próprias (RPS, custo, cache, limites práticos).
- Busca e filtros por categoria para montar a arquitetura em segundos.

### 🤖 Análise e recomendações com IA

- **Análise de arquitetura** (`POST /api/v1/analyze`): nota justificada, pontos fortes, riscos, sugestões e achados com severidade.
- **Recomendações de stack** acopladas às tecnologias escolhidas (`stack-recommend.ts`).
- **Comparação lado a lado** de duas arquiteturas (`/compare`) com delta de nota, custo e simplicidade.
- **Fallback heurístico determinístico** quando a IA não está disponível — a análise nunca fica em branco.
- **Configurações de IA em runtime** (`/api/v1/settings/ai`): provider, base URL, modelo, chave e teste de conectividade.

### ⚙️ Motor de simulação

- Simulação **determinística** (seed reproduzível) de **carga**, **jornada de usuário** e **eventos de falha** sobre o grafo desenhado — sem disparar HTTP real.
- **Três modos de teste**:
  - **Load Test**: carga normal — testa capacidade sustentável
  - **Stress Test**: aumenta progressivamente até quebrar — encontra o teto real
  - **Soak Test**: carga sustentada prolongada — testa estabilidade
- **Modelo de capacidade por componente**: cada tecnologia tem RPS realista (FastAPI ~2000 RPS, PostgreSQL ~50 RPS, Redis ~8000 RPS).
- **Análise de Engenharia**: identifica gargalos, mostra capacidades de cada componente, cenários de falha e recomendações.
- **Presets prontos**: `black-friday-spike`, `steady-saas`, `incident-cascade`, `gradual-ramp`.
- Relatórios de gargalos, saturação, eventos em cascata e validação de regras.
- Formatos de saída: `json`, `csv` e `prometheus`.

### 📤 Exportação

- **JSON** — formato proprietário `system-design-saas.graph` (reimportável).
- **PNG** — captura do canvas via `html-to-image` com dimensionamento automático.
- **PDF** — impressão formatada com diagrama + análise completa.
- **Markdown** — documento de arquitetura com contexto, NFRs, componentes, conexões e análise.

### 👥 Usuários e permissões

- Roles: `user` e `senior`.
- **Cadastro público** cria usuários com role `user`.
- **Administração de usuários** (CRUD completo) exclusiva para role `senior` (`/admin/users`).
- **Perfil** com dados de contato, data de nascimento e preferências de auto-save.
- **Recuperação de senha** verificando telefone + data de nascimento, com token de 24h e invalidação de todas as sessões após o reset.

### 🗄️ Grafos (designs salvos)

- CRUD completo de grafos (`/api/v1/graphs`).
- **Versionamento automático** a cada edição salva + restauração de versões anteriores.
- **Fluxo de revisão** com status `draft → analyzed → approved`.
- Metadados ricos: **contexto** e **NFRs** (usuários/dia, orçamento, disponibilidade, latência p99, compliance, ambientes).

### 🎨 Diagramas multi-visual

- **Biblioteca de diagramas** (`DiagramLibrary`) com vistas tipadas: Contexto, Aplicação, Dados, Runtime, Segurança, DR, Sequência.
- **Drill-down C4** com breadcrumb — navegue de região → AZ → serviço → componente.
- **Diagrama de sequência** — visualização numerada de fluxos (request path).
- **Consistência cross-diagram** — valida nós/arestas entre vistas do mesmo projeto.
- **Auto-layout por zonas** — reposicionamento inteligente baseado em zonas VPC/AZ.
- **Caminho crítico** — destaque visual dos nós/arestas que mais impactam a nota.

### 🔒 Governança e SRE

- **ADRs** (Architectural Decision Records) persistidos em Markdown (`docs/adr/`).
- **Policy as code** — avaliações de PII, security groups, trust boundaries.
- **RACI matrix** — gera Responsible, Accountable, Consulted, Informed por squad.
- **SLI/SLO** por serviço com error budget burn rate.
- **Circuit breakers** — visualização de padrões de resiliência.
- **Cost model** — estimativa de custo por serviço/região/tier.
- **Failure injection** — injeta falha em nó e vê blast radius no canvas.

### 🔐 Autenticação e colaboração

- **SSO/OIDC** configurável via env (`GET /auth/sso/config`).
- **Audit trail** — registro de todas as mutações no grafo (`audit_entries`).
- **Comentários no canvas** — pin, @mentions, assignee, resolved (estilo Figma).
- **Views salvas** por usuário com filtros combinados (DOM, provider, owner, C4, PII).
- **Diff visual** — compare v1 vs v2 com highlights verde/vermelho/amarelo no canvas.

### 📊 Análise avançada

- **Evidence nos findings** — botão "Ver evidência no canvas" mostra nós/arestas que puxaram cada eixo do scorecard.
- **Nós críticos** — seção no scorecard lista nós com findings críticos.
- **STRIDE/LINDDUN** — análise de ameaças por trust boundary.
- **Well-Architected** — scorecard paralelo AWS/Azure/GCP (5 pilares).
- **ATAM** — cenários de qualidade ligados a nós/arestas.
- **Fix actions** — 12+ categorias automáticas (bottleneck, CDN, cache, fila, LB, SG, zona, DB, saga, PII, SLO, custo).

### 📐 Catálogo rico

- **100+ tecnologias** com atributos reais: `limits`, `ha_model`, `regions`, `pricing_tier`, `rps_guidance`.
- **Patterns library aplicável** — saga, outbox, CQRS, event-driven, sidecar, strangler materializam nós/arestas no canvas.
- **Catálogo privado** — CRUD com ACL por `owner_team`.
- **Contrato de capacidade** — `capacityContract` editável no card (max_rps, p99_latency_ms).

### 🌐 Interoperabilidade

- **Export**: JSON, PNG, SVG vetorial, PDF, Markdown, PlantUML, Mermaid, C4-PlantUML, draw.io XML.
- **Import draw.io** — upload XML de diagramas existentes.
- **Embed vivo** — SVG vetorial com tema claro/escuro para Notion/Confluence.
- **Wiki viva** — `GET /doc` com Markdown, âncoras estáveis, links para ADR/nós.

### 🎬 Apresentação

- **Presentation Mode** — steps com spotlight, teclas ←→ Espaço T Esc, tema claro/escuro.
- **Sequence mode** — arestas 1..N acesas conforme narrative.
- **Board-ready exports** — title block, legenda, fundo limpo.

### ♿ Acessibilidade

- **WCAG 2.1 AA** — skip links, aria labels, focus outlines visíveis.
- **Atalhos de teclado** — F (focus), Esc (fechar), Del (deletar), Tab (navegar).

## 📋 Pré-requisitos

| Ferramenta | Versão mínima | Observação |
|---|---|---|
| [Python](https://www.python.org/downloads/) | **3.12** | Usado pelo backend (3.10 não funciona — falta `datetime.UTC`) |
| [Node.js](https://nodejs.org/) | **22 LTS** | Usado pelo frontend Next.js |
| npm | — | Acompanha o Node.js |
| Git | — | Controle de versão |

> Opcional, mas recomendado:
>
> - **OmniRoute** rodando em `http://localhost:20128/v1` — habilita análise por IA de verdade.
> - Ou uma **API key** de OpenAI/Anthropic para configurar via painel de settings (`/api/v1/settings/ai`).
>
> Sem IA, o backend continua 100% funcional usando a **heurística local determinística**.

---

## 🚀 Instalação

### 1. Clone o repositório

```bash
git clone <url-do-repositorio> system_design
cd system_design
```

### 2. Backend (FastAPI)

```powershell
cd backend

# Cria o ambiente virtual (Windows)
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1

# Linux/macOS:
# python3.12 -m venv .venv
# source .venv/bin/activate

# Instala dependências (dev inclui pytest e ruff)
pip install -r requirements-dev.txt

# Configura as variáveis de ambiente
copy .env.example .env
```

### 3. Frontend (Next.js)

```powershell
cd ..\web

# Instala dependências
npm install

# Configura a URL da API (ajuste a porta se o backend usar outra)
copy .env.example .env.local
```

> ⚠️ **Importante:** a variável `NEXT_PUBLIC_API_URL` do frontend precisa apontar para a porta real do backend. Use `NEXT_PUBLIC_API_URL=http://localhost:4410` (porta padrão do docker-compose).

### 4. Docker (alternativa — tudo de uma vez)

```powershell
docker compose up --build -d
```

Subirá 3 serviços: **Postgres** (porta `5434`), **backend FastAPI** (porta `4410`) e **frontend Next.js** (porta `3015`). O OmniRoute do host é alcançado via `host.docker.internal:20128`.

> **Nota:** O build do Docker exige a pasta `web/public/` (mesmo que vazia) para o Next.js standalone output. Um `.dockerignore` foi adicionado para excluir `.next/`, `node_modules/` e `.env` do contexto de build.

## ⚙️ Variáveis de ambiente

### Backend (`backend/.env`)

| Variável | Obrigatória | Padrão | Descrição |
|---|---|---|---|
| `DATABASE_URL` | Não | `sqlite:///./data/app.db` | URL do banco. Use `postgresql://...` para PostgreSQL |
| `CORS_ORIGINS` | Não | `http://localhost:3015,http://127.0.0.1:3015` | Origens permitidas, separadas por vírgula (nunca `*` em produção) |
| `ARCHIA_JWT_SECRET` | **Sim (produção)** | `archia-secret-key-change-in-production` | Segredo de assinatura JWT (HS256). **Troque por um valor aleatório de 32+ caracteres** |
| `ARCHIA_ENV` | Não | `development` | `development` ou `production`. Em `production`, os cookies de sessão ficam `Secure` (HTTPS) |
| `LOG_LEVEL` | Não | `INFO` | `DEBUG`, `INFO`, `WARNING` ou `ERROR` |
| `OMNIROUTE_BASE_URL` | Não | `http://localhost:20128/v1` | URL base da IA OmniRoute |
| `OMNIROUTE_API_KEY` | Não | `local` | Chave de API da OmniRoute |
| `OMNIROUTE_MODEL` | Não | `auto/coding` | Modelo padrão da OmniRoute |
| `OMNIROUTE_TIMEOUT_S` | Não | `45.0` | Timeout (s) das chamadas de IA |

> As preferências de IA também podem ser gerenciadas em **runtime** via `GET/PUT /api/v1/settings/ai` (provider, base URL, modelo, API key, enabled) — os valores do banco têm prioridade sobre as env vars.

### Frontend (`web/.env.local`)

| Variável | Obrigatória | Padrão | Descrição |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | Sim | `http://localhost:4410` | URL base da API backend (deve bater com a porta do uvicorn) |

---

## ▶️ Executando o projeto

### Backend

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 4410
```

- API disponível em **http://localhost:4410**
- Documentação interativa (Swagger UI) em **http://localhost:4410/docs**
- Na inicialização, o backend cria as tabelas e **seeda o usuário padrão** automaticamente.

### Frontend

```powershell
cd web
npm run dev
```

Abra **http://localhost:3015**.

### Páginas do frontend

| Rota | Descrição |
|---|---|
| `/` | **Editor visual** (canvas principal) |
| `/login` | Login |
| `/register` | Cadastro de novo usuário |
| `/recover` | Recuperação de senha (telefone + data de nascimento) |
| `/profile` | Perfil do usuário (inclui preferências de auto-save) |
| `/admin/users` | Gestão de usuários (somente role `senior`) |
| `/graphs` | Lista de grafos salvos |
| `/graphs/[id]` | Abre um grafo salvo no editor |
| `/compare` | Comparação lado a lado de duas arquiteturas |

## 🔑 Credenciais padrão

O backend cria automaticamente um usuário `senior` na primeira inicialização:

| Username | Senha | Role | Email | Telefone | Nascimento |
|---|---|---|---|---|---|
| `SENIOR` | `CHANGEPASSWORD` | `senior` | `senior@archia.local` | `+5511999999999` | `1990-01-01` |

> ⚠️ **Mude a senha padrão antes de usar em qualquer ambiente que não seja local.** Novos usuários cadastrados via `/auth/register` nascem sempre com role `user`.

---

## 🔌 Referência de endpoints da API

> Documentação interativa e testável: **http://localhost:4410/docs** (Swagger UI).

### Saúde

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/health` | Health check (`{"status": "ok"}`) |

### Autenticação (`/auth`)

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/auth/register` | Cria conta (role `user`). Valida username, email, telefone e complexidade de senha |
| `POST` | `/auth/login` | Login (username + senha + `remember_me`). Define cookie `archia_session` e retorna token |
| `POST` | `/auth/logout` | Encerra a sessão (remove registro no banco e limpa o cookie) |
| `GET` | `/auth/me` | Retorna o usuário autenticado |
| `POST` | `/auth/recover` | Inicia recuperação (username + telefone + nascimento). Retorna `reset_token` (24h) |
| `POST` | `/auth/reset-password` | Troca a senha com o token e **invalida todas as sessões** do usuário |

### Usuários (`/users` — somente role `senior`)

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/users/` | Lista todos os usuários |
| `GET` | `/users/{user_id}` | Busca um usuário |
| `PUT` | `/users/{user_id}` | Atualiza usuário (inclui troca de role) |
| `DELETE` | `/users/{user_id}` | Remove usuário (proibido excluir a própria conta) |

### Perfil (`/profile`)

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/profile/` | Perfil do usuário autenticado |
| `PUT` | `/profile/` | Atualiza perfil (username, email, telefone, nascimento, auto-save) |
| `DELETE` | `/profile/` | Exclui a própria conta |

### Grafos e análise (`/api/v1`)

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/v1/graphs` | Lista grafos salvos |
| `POST` | `/api/v1/graphs` | Cria grafo (name, context, nfr, nodes, edges) |
| `GET` | `/api/v1/graphs/{graph_id}` | Busca um grafo |
| `PUT` | `/api/v1/graphs/{graph_id}` | Atualiza grafo (gera nova versão/snapshot) |
| `DELETE` | `/api/v1/graphs/{graph_id}` | Remove grafo |
| `GET` | `/api/v1/graphs/{graph_id}/versions` | Lista versões do grafo |
| `POST` | `/api/v1/graphs/{graph_id}/versions/{version_id}/restore` | Restaura uma versão anterior |
| `POST` | `/api/v1/graphs/{graph_id}/review` | Registra revisão (status, comentário, role do revisor) |
| `POST` | `/api/v1/analyze` | Análise de arquitetura em memória (IA + heurística), com persistência opcional |
| `POST` | `/api/v1/graphs/{graph_id}/analyze` | Analisa um grafo salvo |
| `POST` | `/api/v1/compare` | Compara duas arquiteturas (nota, custo, simplicidade) |
| `POST` | `/api/v1/analyze/heuristic` | Atalho determinístico de análise (sem IA) |

### Configurações de IA (`/api/v1/settings`)

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/v1/settings/ai` | Configuração atual (chave sempre mascarada) |
| `PUT` | `/api/v1/settings/ai` | Atualiza provider, base URL, modelo, chave e enabled |
| `POST` | `/api/v1/settings/ai/test` | Testa conectividade com o provedor (latência em ms) |

### Simulações (`/api/v1/simulations`)

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/v1/simulations/presets` | Lista presets disponíveis |
| `GET` | `/api/v1/simulations/presets/{preset_id}` | Detalhe de um preset |
| `POST` | `/api/v1/simulations/run` | Roda simulação (carga + jornada + eventos) sobre nodes/edges |
| `POST` | `/api/v1/simulations/run-preset` | Roda simulação a partir de um preset |

> Formatos de saída de simulação: `json` (padrão), `csv` e `prometheus` (via `output_format`).

## 🗂️ Estrutura do projeto

```text
system_design/
├── backend/                        # API FastAPI (Python 3.12)
│   ├── app/
│   │   ├── main.py                 # Bootstrap: FastAPI, CORS, criação de tabelas, seed
│   │   ├── config.py               # Settings via pydantic-settings (lê .env)
│   │   ├── database.py             # Engine + Session SQLAlchemy
│   │   ├── seed.py                 # Cria o usuário SENIOR padrão
│   │   ├── rate_limit.py           # Rate limiting em memória (login/recover)
│   │   ├── auth/
│   │   │   ├── jwt.py              # Emissão/validação de tokens JWT (HS256)
│   │   │   └── security.py         # Hash/verificação bcrypt
│   │   ├── models/                 # User, Session, Graph, GraphVersion, AiSettings
│   │   ├── schemas/                # Pydantic v2 (validação de inputs/outputs)
│   │   ├── routes/                 # health, auth, users, profile, graphs, settings, simulations
│   │   ├── services/               # heuristic, simulation, omniroute, ai_settings
│   │   └── agents/runner.py        # Orquestração da análise (IA + fallback heurístico)
│   ├── tests/                      # Suíte pytest (integração, segurança, fuzz, e2e)
│   ├── requirements.txt            # Dependências de produção
│   ├── requirements-dev.txt        # Dependências de desenvolvimento (pytest, ruff)
│   ├── .env.example                # Modelo de variáveis de ambiente
│   └── Dockerfile
├── web/                            # Frontend Next.js 16 (React 19 + TypeScript)
│   ├── src/
│   │   ├── app/                    # Páginas: /, /login, /register, /recover, /profile,
│   │   │                           #   /admin/users, /graphs, /graphs/[id], /compare
│   │   ├── components/
│   │   │   ├── canvas/             # DesignCanvas, RecommendationBanner
│   │   │   ├── nodes/              # BlockNode, ArchNode, AnchorHandle
│   │   │   ├── sidebar/            # ComponentPalette, CatalogLibrary
│   │   │   ├── panels/             # Analysis, Simulation, Properties, Inspector, History,
│   │   │   │                       #   Review, Settings, Context, Kickoff, ADR
│   │   │   ├── layout/             # EditorShell, TopBar, ExportMenu, DomainNotice
│   │   │   ├── ui/                 # Toggle, Select, ConfirmDialog, ResizablePanel, ScrollCarousel
│   │   │   └── compare/            # CompareView
│   │   └── lib/                    # api, auth-store, graph-store, export, export-canvas,
│   │                               #   snap, catalog, stack-recommend, simulation, blocks,
│   │                               #   templates, nfr, adr, kickoff, types
│   ├── package.json
│   ├── .env.example
│   └── Dockerfile
├── docs/
│   └── README.md                   # Documentação complementar
├── docker-compose.yml              # Orquestração backend + web
└── README.md
```

---

## 🔒 Segurança

O Archia adota boas práticas de segurança desde a base:

### Autenticação e sessão

- **Senhas** com hash **bcrypt** (sal único por usuário).
- **Tokens JWT (HS256)** assinados com `ARCHIA_JWT_SECRET` — **obrigatório** trocar em produção.
- Sessão por **cookie `archia_session`**: `HttpOnly`, `SameSite=Lax` e `Secure` quando `ARCHIA_ENV=production` (HTTPS).
- **Remember-me**: sessão de **7 dias** quando marcado; **24 horas** caso contrário.
- **Logout** remove o registro de sessão do banco e limpa o cookie.

### Validação de entrada (Pydantic v2)

- **Complexidade de senha**: mínimo 8 caracteres, pelo menos 1 letra maiúscula e 1 minúscula (e não apenas espaços).
- **Username**: 3+ caracteres, somente ASCII alfanumérico.
- **Email**: formato validado por regex.
- **Telefone**: 7 a 15 dígitos, opcionalmente iniciado com `+`.
- **Intervalo de auto-save**: restrito a `{0, 5, 15, 30, 60}` minutos.

### Proteção contra abuso

- **Rate limiting em memória**:
  - Login: **5 tentativas / 60 s** por IP + username (`HTTP 429`).
  - Recuperação de senha: **3 tentativas / 300 s** por IP + username.
- **Recuperação de senha** exige conhecimento de **telefone + data de nascimento** (não apenas o username).
- Ao **resetar a senha**, **todas as sessões** do usuário são invalidadas no banco — tokens antigos viram inúteis mesmo antes de expirar.

### Autorização

- Rotas `/users/*` exigem role **`senior`** (`get_current_senior_user`) — senão `HTTP 403`.
- Rotas `/profile/*` e `/auth/me` exigem autenticação.
- Novo usuário cadastrado nunca recebe role elevada.

### Outros

- **CORS** restrito a origens explicitamente configuradas (`CORS_ORIGINS`); `allow_credentials=True` com origens específicas — nunca `*` em produção.
- Chave de API de IA **nunca** retorna em respostas (`api_key_masked`).
- Queries usam SQLAlchemy (parâmetros bind — sem concatenação de strings).

> 🚧 **Roadmap de segurança:** na iteração atual, as rotas de grafos/simulações/settings (`/api/v1/graphs`, `/api/v1/simulations`, `/api/v1/settings`) ainda não exigem autenticação. Proteger esses recursos é o próximo passo planejado.

## 🧪 Testes

### Backend (pytest)

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
py -3.12 -m pytest -q
```

A suíte cobre **integração HTTP**, **segurança**, **validação de schemas**, **fuzz de propriedades** e **fluxos e2e de análise**:

| Arquivo | Cobre |
|---|---|
| `test_auth_integration.py` | Registro, login, logout, me, recuperação e reset de senha |
| `test_auth_security.py` | Cookies, invalidação de sessão, tokens expirados |
| `test_users_integration.py` | CRUD de usuários (senior-only) |
| `test_profile_integration.py` | Perfil, auto-save e exclusão de conta |
| `test_security.py` | Rate limiting e proteções |
| `test_schemas_validation.py` | Validação Pydantic (senha, email, telefone) |
| `test_property_fuzz.py` | Testes de propriedade (fuzz) |
| `test_graphs_api.py` | CRUD de grafos, versões, restore, review |
| `test_simulations.py` | Motor de simulação e presets |
|| `test_simulation_realistic.py` | Simulação realista: capacidade por componente, modos de teste (load/stress/soak), análise de engenharia |
| `test_ai_settings.py` | Configurações de IA e teste de conectividade |
| `test_heuristic.py` / `test_e2e_analysis.py` | Heurística e análise ponta a ponta |
| `test_nfr_kickoff.py` | NFRs e painel de kickoff |

> O `conftest.py` usa `sqlite:///:memory:`, limpa o rate limiter entre testes e stubba a IA (`no_omniroute`) — a suíte roda sem rede e sem serviços externos.

### Frontend (node test runner)

```powershell
cd web
npm test
```

Executa testes de unidade/roundtrip do TypeScript (Node com `--experimental-strip-types`):
- `src/lib/export.roundtrip.test.ts` — roundtrip de exportação/importação
- `src/lib/blocks.test.ts` — blocos e regras do editor
- `src/lib/canvas-pro.test.ts` — comportamento do canvas

### Lint

```powershell
cd backend && ruff check .        # Python (Ruff)
cd web && npm run lint            # Frontend (ESLint)
```

---

## 🤝 Contribuição

1. **Crie uma branch** a partir da `main` atualizada:

   ```bash
   git fetch origin
   git checkout main && git pull --rebase origin main
   git checkout -b feature/sua-feature
   ```

2. **Commits pequenos e atômicos** seguindo [Conventional Commits](https://www.conventionalcommits.org/):

   ```
   feat(editor): adiciona snap alignment no canvas
   fix(auth): corrige validação de telefone na recuperação
   ```

3. **Rode lint e testes** antes de abrir o PR (ver [Testes](#-testes)).

4. **Abra um Pull Request** descrevendo o que foi feito e como testar.

### Boas práticas

- Nunca commitar direto na `main` — sempre via branch + PR.
- Nunca incluir segredos/`.env` no repositório.
- Ao adicionar variável de ambiente nova, atualizar os `.env.example` e esta documentação.
- Manter a cobertura de testes das 3 camadas: unitário, integração e e2e.
- Documentar features novas em `docs/`.

---

## 📄 Licença

Projeto interno. Consulte a organização para detalhes de uso e distribuição.

<p align="center">
  <sub>Feito com 🧠 para arquitetos de software — <strong>Archia</strong> · system-design-saas</sub>
</p>
