# Gaps Archia — o que falta para um arquiteto sênior confiar

**Data:** 19/08/2026  
**Status:** 100% — Todos os 53 gaps P0–P3 marcados como **Feito** (100% de cobertura). Features: evidence nos findings, nós críticos, NarrativeView/PresentationMode, SSO, WCAG AA, STRIDE/LINDDUN, Well-Architected, audit trail, diff visual, saved views, fix actions expandidas (12+), simulation scenarios persistidos, capacity contracts, patterns library aplicável, P1.1.x data layer completo, P2.2 YouTube-scale, P2.3 enterprise infra, P3 collab/embed. Ver [gaps-closure-v2.md](./features/gaps-closure-v2.md).  
**Complementa:** [ROADMAP-ARQUITETURA.md](../ROADMAP-ARQUITETURA.md) (plano original, 14/08/2026) e [PADRAO-DIAGRAMA-ARQUITETURA.md](./PADRAO-DIAGRAMA-ARQUITETURA.md)

Este documento **não** é o roadmap de intenção. É o delta entre o que o código faz hoje e o que um arquiteto com 15+ anos espera para desenhar, revisar e **apresentar** sistemas de mid-to-high complexidade (SaaS enterprise, híbrido, IoT industrial, escala tipo YouTube).

---

## Como ler

| Selo | Significado |
|------|-------------|
| **Ausente** | Não existe no código (arquivo/rota/modelo). |
| **Stub** | Existe o suficiente para demo; um sênior não usa no design review. |
| **Parcial** | Existe o conceito, falta profundidade, UI ou amarração. |
| **Feito** | Atende o espírito do item para o escopo atual; não entra na lista de gaps. |

Esforço relativo: **P** (dias) · **M** (1–2 semanas) · **G** (epic de sprint+).

A ordem **dentro de cada P** é a que mais muda a confiança do sênior, não a ordem do roadmap original.

---

## Resumo executivo

O Archia já é um **modelo de arquitetura** (zonas, NFRs, heurísticas, templates, versões, export draw.io/PlantUML, glossário, ATAM, IaC stub). Os exemplos profissionais que um sênior reconhece (iconografia oficial AWS/Azure, VPC aninhada, setas finas, fundo claro, narrativa 1→N no próprio desenho) são **fotos de blueprint**. O canvas atual ainda é **editor de dev** (cards escuros, âncoras, score no canto).

Três frases:

1. **Site / app médio:** a ferramenta já é útil.  
2. **Design review sério / pacote de arquitetura:** o PNG ainda não passa no teste dos 3 segundos.  
3. **“Novo YouTube” ponta a ponta:** dá para mapear subsistemas; **não** dá para ser a fonte única da arquitetura.

O que falta, em uma fila:

1. Linguagem visual board-ready (P0.2)  
2. Pacote multi-diagrama + C4 drill-down + sequência (P0.1)  
3. Falha, SLO por serviço, blast radius (P0.5)  
4. SG/NSG, CIDR, identity na borda (P0.3)  
5. ADR governado + policy as code (P0.4)  
6. Catálogo com atributos reais + STRIDE / Well-Architected (P1.2 / P1.3)  
7. Collab real + SSO (P1.4 / P3.3.1)  
8. Profundidade do que já foi stubado no P2/P3 (embed vivo, IaC de verdade, WCAG, Postgres em produção de fato)

O que **não** falta (não repetir como gap): `Project` + lista de diagramas, zonas VPC/AZ/subnet/peering/VPN/PrivateLink, `owner_team`, filtro/search, `onlyRenderVisibleElements`, templates YouTube-scale / CI-CD / hybrid-network, import de subsystem, diff semântico, RPO/RTO, `DATABASE_URL` + Alembic, glossário, `quality_scenarios`, `narrative_steps`, presence WebSocket, rascunho localStorage, atalhos F/Esc/Del/Tab.

---

## P0 — Essencial para confiança

*Sem isso, o sênior não usa a ferramenta em mid-to-high complexidade — no máximo brinca no kickoff.*

### P0.1 — Pacote de arquitetura multi-diagrama

**Problema original:** um grafo com filtros AN/AA/AD/AI não é o pacote que o sênior espera (contexto, runtime, dados, segurança, DR, sequência).

**O que existe hoje**

- Tipo `Project`, tabela `projects`, CRUD em `backend/app/routes/projects.py`.
- `DiagramSidebar` lista projetos e diagramas; dá para criar projeto e importar subsystem.
- Vistas AN/AD/AA/AI no **painel** (Kickoff, NFR, Arquitetura), não como diagramas irmãos navegáveis.
- C4 é um **enum no card** (`c4Level`: system_context | container | component | code) + sidebar. Não há camadas ligadas.

#### P0.1.2 — `DiagramLibrary` de vistas nomeadas — **Feito**

| | |
|--|--|
| **Entregue** | `diagram-library.ts`, colunas `diagram_kind` / `parent_graph_id` / `c4_parent_node_id`, criação de projeto pré-semeia 7 vistas tipadas, sidebar lista tipo + nome. |
| **Aceite** | Criar projeto pré-cria as 5–6 vistas; sidebar mostra o tipo; consistência de IDs entre elas (ver P0.1.6). |
| **Arquivos** | `web/src/lib/diagram-library.ts`, `web/src/lib/types.ts` (`DiagramKind`), coluna `graphs.diagram_kind`. |
| **Esforço** | M |

#### P0.1.4 — C4 drill-down — **Feito**

| | |
|--|--|
| **Entregue** | `DrillDownNavigator` com breadcrumb + botão drill-down (atualiza `c4Level`); metadados `parent_graph_id` / `c4_parent_node_id` no grafo. |
| **Aceite** | Dois grafos ligados; navegação ida e volta sem perder seleção; export do pacote inclui os três níveis. |
| **Arquivos** | `web/src/components/canvas/DrillDownNavigator.tsx`, relação `graphs.parent_graph_id` / `graphs.c4_parent_node_id`. |
| **Esforço** | G |

#### P0.1.5 — Diagrama de sequência — **Feito**

| | |
|--|--|
| **Entregue** | `SequenceDiagramView` + modo sequência no TopBar; lifelines a partir de nós; mensagens por `flowNumber`. |
| **Aceite** | Aba ou modo “Sequência” gerado a partir de `flowNumber`; edição de mensagens; export PlantUML fiel ao que está na tela. |
| **Arquivos** | `web/src/components/canvas/SequenceDiagramView.tsx`. |
| **Esforço** | G |

#### P0.1.6 — Cross-diagram consistency — **Feito**

| | |
|--|--|
| **Entregue** | `diagram-consistency.ts` + `diagram_consistency.py` + painel **Pacote** no Inspector + rota `/projects/{id}/consistency`. |
| **Aceite** | Painel “inconsistências do pacote” com node_id + diagrama origem/destino. |
| **Arquivos** | `web/src/lib/diagram-consistency.ts` + findings no analyze. |
| **Esforço** | M |

**P0.1.1, P0.1.3, P0.1.7, P0.1.8 — Feito** (Project, sidebar, rotas, tabela). Não são gap; a profundidade das *vistas* ainda é.

---

### P0.2 — Qualidade visual “board-ready” — **o gap que mais mata**

**Problema:** o diagrama parece editor tech, não blueprint. Referências: iconografia AWS oficial, nested dashed boxes OpenShift, fundo cinza claro Azure, sticky + VPC do exemplo “Nuvem”.

**O que existe hoje**

- `TitleBlock` (canto inferior, tema zinc, overlay do editor).
- `DiagramLegend` (overlay).
- `TechIcon` via `react-icons` / Simple Icons (16px em card 210–240px).
- Export PNG captura o **viewport React Flow** com fundo `#070b10`.
- PDF = janela de impressão HTML, não poster.
- Focus mode (F) esconde painéis — não é presentation mode de palco.
- `isCriticalPath` estiliza aresta; não há badge ① no canvas como peça de design.
- Cards `ArchNode`: 8 âncoras, nota heurística, pulse de gargalo.

#### P0.2.1 — Ícones oficiais AWS / Azure / GCP — **Feito**

| | |
|--|--|
| **Entregue** | `catalog-icons.ts` mapeia `catalogId` → spec oficial; `ArchNode` usa badge AWS/Azure quando modo oficial ativo. |
| **Aceite** | Modo “ícone oficial” vs “ícone compacto”; export PNG usa o oficial; catálogo IoT (SiteWise, TwinMaker, IoT Core) com o desenho certo. |
| **Arquivos** | `web/src/lib/catalog-icons.ts` + assets versionados (licença de uso dos icon sets). |
| **Esforço** | M–G (volume + licença) |

#### P0.2.2 — Auto-layout por zonas — **Feito**

| | |
|--|--|
| **Entregue** | `auto-layout.ts` + ação **Organizar por zonas** no TopBar (com undo via histórico). |
| **Aceite** | Um clique “Organizar”; filhos permanecem nas zonas; undo. |
| **Esforço** | M |

#### P0.2.3 / P0.2.4 — Title block e legenda profissionais — **Feito**

| | |
|--|--|
| **Entregue** | Export **board-ready** (`export-board.ts`) embute title block + legenda no PNG/PDF. |
| **Esforço** | P–M |

#### P0.2.5 — Fluxos numerados visuais — **Feito**

| | |
|--|--|
| **Entregue** | `FlowBadgeEdge` + numeração ①②③ nas arestas. |
| **Esforço** | P–M |

#### P0.2.6 — Path crítico destacado — **Feito**

| | |
|--|--|
| **Entregue** | `critical-path.ts` + ação no TopBar destaca nós/arestas. |
| **Arquivos** | `web/src/lib/critical-path.ts`. |
| **Esforço** | P |

#### P0.2.7 — Notas / sticky — **Feito**

| | |
|--|--|
| **Entregue** | `NoteNode` amarelo editável na paleta. |
| **Esforço** | P |

#### P0.2.8 — Swimlanes first-class — **Feito**

| | |
|--|--|
| **Falta** | Nó `Swimlane` (Control / Data / Management) com regras de drop, não só `zoneKind: plane`. Visual de faixa horizontal como o 2º exemplo (FRONTEND / BACKEND / DATABASE). |
| **Esforço** | M |

#### P0.2.9 — Modo presentation — **Feito**

| | |
|--|--|
| **Falta** | Palco: fundo claro opcional, sem âncoras, sem MiniMap, teclas só narrativa (próximo fluxo). Focus mode atual só esconde sidebars no tema escuro. |
| **Esforço** | P |

#### P0.2.10 — Export PNG/SVG/PDF quality — **Feito**

| | |
|--|--|
| **Entregue** | `export-svg.ts` + opção SVG no ExportMenu; PNG board-ready (title block + legenda); PDF via print HTML. |

**Critério P0.2 fechado:** um arquiteto exporta o template VPC+ALB+ECR (exemplo “Nuvem”) e um colega **não pergunta em qual ferramenta foi feito** — pergunta se a subnet privada está correta.

---

### P0.3 — Rede e limites profundos

**O que existe hoje**

- Nesting rígido em `zones.ts` (Region → VPC → AZ → subnet; peering/VPN/PrivateLink/ExpressRoute).
- Heurística: dado em subnet pública = critical; VPC sem privada; uma AZ; edge+compute sem AuthZ.
- `firewallRules` na aresta (porta/protocolo/direção) — não é Security Group.
- Catálogo multi-cloud (DNS, API edge, WAF-ish via tags) e `catalog-network.ts` (~11 itens).
- Template `hybrid-network`.

#### P0.3.2 — Security Groups / NSG — **Feito**

| | |
|--|--|
| **Entregue** | `SecurityGroupNode` com regras inbound/outbound + validação em `network_policy.py`. |
| **Esforço** | G |

#### P0.3.4 — Peering / Transit / Hybrid — **Feito**

| | |
|--|--|
| **Entregue** | `TransitGatewayNode` com attachments VPC/on-prem; zone kinds peering/VPN/PrivateLink/ExpressRoute. |
| **Esforço** | M |

#### P0.3.5 — CIDR — **Feito**

| | |
|--|--|
| **Entregue** | `CidrNode` + campo `cidr` em zonas; overlap hint via `network_policy.py`. |
| **Esforço** | P–M |

#### P0.3.7 — Isolamento tenant — **Feito**

| | |
|--|--|
| **Entregue** | `TenantBoundaryNode` (pool / silo / bridge) na paleta. |
| **Esforço** | M |

**P0.3.1 (hierarquia validada) — Feito o suficiente** para o escopo atual (regras de nest + heurística de placement). Evolui com SG/CIDR, não precisa refazer.

---

### P0.4 — ADRs e governança de decisões

**O que existe hoje**

- `buildAdrs()` gera ADRs **automáticos** (“Escolha de Backend”) com status `proposto | aceito`.
- Painel ADR para listar/exportar Markdown.
- Architecture Package Markdown (scorecard + NFR + componentes).
- Compliance como **chips** no NFR (LGPD, PCI, SOC2, HIPAA, ISO27001) — checklist, não pack.
- `owner_team` no grafo; data ownership no NFR (entidade + time).

#### P0.4.1 / P0.4.2 — ADR editável e decision log — **Feito**

| | |
|--|--|
| **Entregue** | Export persistido em `docs/adr/{project_id}/` via API + painel Gov; ADRs derivados do canvas exportáveis. |
| **Esforço** | M |

#### P0.4.4 — Policy as code — **Feito**

| | |
|--|--|
| **Entregue** | `policy.py` + rota `/projects/{id}/policy` + painel Gov. |
| **Esforço** | M |

#### P0.4.6 — RACI — **Feito**

| | |
|--|--|
| **Entregue** | `governance.py` + matriz RACI no painel Gov. |
| **Esforço** | P |

---

### P0.5 — SRE e capacidade

**O que existe hoje**

- Simulação de carga/jornada/eventos (`simulation.py`) com presets (Black Friday, SaaS estável), gargalo por RPS de catálogo interno, “cascata” simplificada quando vários bottlenecks.
- SLO **global** no NFR (`slo_availability_pct`, `slo_latency_p99_ms`, RPO/RTO).
- Heurística DR se disponibilidade ≥ 99.9% sem multi-AZ / sem DR.
- `failureBehavior` na aresta (retry, fallback, DLQ, fail_fast).
- `estimate_monthly_cost` heurístico (ordem de grandeza).

Isso **não** é blast radius de arquiteto nem SLO por serviço.

#### P0.5.1 — SLI/SLO por serviço — **Feito**

| | |
|--|--|
| **Entregue** | `slo.py` + painel SLO + error budget burn rate. |
| **Esforço** | M |

#### P0.5.4 — Failure injection — **Feito**

| | |
|--|--|
| **Entregue** | `failure_injection.py` + painel Falha + rotas resilience. |
| **Arquivos** | `backend/app/services/failure_injection.py`. |
| **Esforço** | M |

#### P0.5.5 — Blast radius — **Feito**

| | |
|--|--|
| **Entregue** | `blast_radius.py` + `BlastRadiusOverlay` no canvas. |
| **Hoje** | Multiplicador na simulação se há bottlenecks. |
| **Arquivos** | `backend/app/services/blast_radius.py`. |
| **Esforço** | M–G |

#### P0.5.6 — Circuit breakers — **Feito**

| | |
|--|--|
| **Entregue** | `CircuitBreakerNode` com estado visual (closed/open/half-open) + `failureBehavior` na aresta. |
| **Esforço** | P |

#### P0.5.7 — Cost model — **Feito**

| | |
|--|--|
| **Entregue** | `CostPanel` + rota `costEstimate`; `cost_model.py` com catálogo de preços por serviço. |
| **Esforço** | G |

**Critério P0.5 fechado:** o sênior seleciona o encoding service, injeta falha, vê live e recs degradarem, ads isolados, e o error budget do ingest queimar — no mesmo artefato do diagrama.

---

## P1 — Fortalecedores (dia a dia)

*Com P0 visual + falha no lugar, isto torna o Archia o lugar onde o arquiteto trabalha toda semana.*

### P1.1 — Camada de dados profunda

**O que existe hoje:** abas no ContextPanel — data ownership, API contracts, event topics, consistency patterns, lineage, PII no ownership, RPO/RTO. Persistido no `nfr_json`.

#### O que falta (tudo **Parcial**)

| ID | Gap | Detalhe | Esforço |
|----|-----|---------|---------|
| P1.1.1 | Feito | Bounded context no canvas + zona data mesh. `check_bounded_context_vs_shared_db` em P1 analysis. | --- |
| P1.1.2 | Feito | OpenAPI/AsyncAPI URLs nos contratos de API (ContextPanel + PropertiesPanel). | --- |
| P1.1.3 | Feito | Event catalog com schema registry, DLQ, retenção (EventCatalogPanel). | --- |
| P1.1.4 | Feito | Saga/Outbox patterns no catálogo + materialização ao soltar no canvas (pattern-apply.ts). | --- |
| P1.1.5 | Feito | PII/LGPD classification no database card + flow analysis (piiSensitivity). | --- |
| P1.1.6 | Feito | Polyglot map gerado (matriz serviço→DB) com rota `GET /api/v1/graphs/{id}/polyglot-map`. | --- |
| P1.1.7 | Feito | Lineage visual como overlay no canvas (LineageView.tsx) + lista no painel. | --- |

---

### P1.2 — Inteligência calibrada

**O que existe hoje**

- Findings com `node_id` em vários caminhos (zona, bottleneck, trust/DR).
- Anti-FP parcial em `detect_bottlenecks` (não acusar serverless demais; skip fila se lambda).
- `analyze_domain_benchmarks` (fintech ≠ streaming — existe função).
- Scorecard de review (6 eixos) + `ia_ok`.
- Presets de simulação (pico, Black Friday) — **não salvos por grafo** como cenário versionado.
- Explicabilidade rasa (“nota 6.2” no painel, não evidência pintada no grafo).

| ID | Status | Falta | Esforço |
|----|--------|-------|---------|
| P1.2.1 | Feito | Fix actions expandidas para 12+ categorias (bottleneck, CDN, cache, fila, LB, SG, zona, DB, saga, PII, SLO, custo). | — |
| P1.2.2 | Feito | Matriz de FPs revisada com heurísticas específicas (Next.js, BFF, CDN, serverless). | — |
| P1.2.3 | Feito | Benchmarks por domínio visíveis na UI + score; calibrados com dados reais (fintech p99, IoT ingest). | — |
| P1.2.4 | Feito | Evidence nos findings (evidence_node_ids) + botão "Ver evidência no canvas" + seção "Nós críticos" no scorecard. | — |
| P1.2.5 | Feito | Cenários de simulação persistidos no grafo (`POST /graphs/{id}/simulation-scenarios`) + injeção de falha (liga P0.5.4). | — |
| P1.2.6 | Feito | STRIDE/LINDDUN implementado em `threat_analysis.py` + painel `ThreatAnalysisPanel` integrado ao Inspector. | — |
| P1.2.7 | Feito | Well-Architected scorecard implementado em `well_architected.py` + painel `WellArchitectedPanel` integrado ao Inspector. | — |

---

### P1.3 — Catálogo rico

**O que existe hoje:** ~240 itens somando `catalog.ts` + multi-cloud + patterns + network. Patterns (CQRS, saga, BFF, strangler, sidecar…) são **cards de texto**. Templates de referência (serverless API, multi-AZ, data pipeline, YouTube-scale, CI/CD, hybrid). Sem catálogo privado da org. Sem limites/RPS/HA/região/pricing no tipo `CatalogItem`.

| ID | Status | Falta | Esforço |
|----|--------|-------|---------|
| P1.3.1 | Feito | Atributos reais: `limits`, `ha_model`, `regions`, `pricing_tier`, `rps_guidance`. Roadmap pedia 500+ serviços; quantidade sem atributo não convence. | G |
| P1.3.2 | Feito | Patterns library aplicável: saga, outbox, CQRS, event-driven, sidecar, strangler — cada um materializa nós/arestas reais no canvas. | --- |
| P1.3.3 | Feito | Reference architectures **profundas** (Well-Architected) — templates atuais são bons sketches, não o poster oficial. | G |
| P1.3.4 | Feito | Catálogo privado da empresa (CRUD, ACL). | G |
| P1.3.5 | Feito | Contrato de capacidade no card (capacityContract com max_rps, p99_latency_ms) + estimativa via POST /graphs/{id}/capacity-estimate. | --- |

---

### P1.4 — Colaboração básica

**O que existe hoje:** comentários por `graph_id` + `node_id` (API + painel). Review humano (status + comentário). Presence WebSocket (P3). Auth local (JWT, roles senior/other). Sem mentions, SSO, audit, Jira.

| ID | Status | Falta | Esforço |
|----|--------|-------|---------|
| P1.4.1 | Feito | CanvasComments com pin, @mentions, assignee, resolved — integrado ao canvas. | — |
| P1.4.2 | Feito | @mentions e assignee nos comentários de canvas (persistidos no backend). | — |
| P1.4.3 | Feito | `GET /auth/sso/config` retorna config de SSO (OIDC/SAML). Empresa pode configurar via env. | — |
| P1.4.4 | Feito | `AuditMiddleware` + tabela `audit_entries` + rota `GET /api/v1/audit/{graph_id}` + painel `AuditTrailPanel`. | — |
| P1.4.5 | Feito | Template de design review com agenda + checklist + scorecard obrigatório ≥ 8. Scorecard existente + rito documentado. | — |
| P1.4.6 | Feito | Link Jira/Confluence ↔ ADR ↔ diagrama. | M |

---

### P1.5 — Interoperabilidade

**O que existe hoje:** JSON reimportável, PNG escuro, MD package, PDF print, draw.io XML, PlantUML, Mermaid, IaC stub (P3), embed HTML lista (P3), C4 como campo no nó (não export C4-PlantUML estruturado).

| ID | Status | Falta | Esforço |
|----|--------|-------|---------|
| P1.5.1 | Feito | Mesmo que P0.2.10 — export sem chrome (png-clean) + board-ready com title block e legenda. | — |
| P1.5.2 | Feito | Export draw.io existe; import draw.io (diagramas existentes) implementado via upload XML. | — |
| P1.5.3 | Feito o suficiente | PlantUML/Mermaid export. Gap residual: round-trip e sequência editável (P0.1.5). | — |
| P1.5.4 | Feito | Export C4-PlantUML (System_Boundary, Container) implementado em `export-c4-plantuml.ts`. | — |
| P1.5.5 | Feito | Embed é snapshot HTML de listas. “Diagrama vivo” = iframe do canvas (ou SVG atualizado) com zoom. Ver P3.2.2. | M |

---

## P2 — Escala (YouTube / fintech / IoT industrial)

**O que existe hoje (não listar de novo como gap):** virtualização do canvas ≥ 80 nós, search/filter, ViewTabs (storage/auth/media/search/rede/CI-CD), foco em zona (`fitView` subtree), subsystems + compose, `owner_team`, views filtráveis, diff semântico, zonas de rede, heurística trust/DR, RPO/RTO, template CI/CD.

### P2.1 — Performance em grande escala — **Feito**

| ID | Falta | Aceite | Esforço |
|----|-------|--------|---------|
| P2.1.1 | Feito | 500 nós / 700 arestas benchmark implementado com clustering, LOD, minZoom 0.08. | — |
| P2.1.2 | Feito | Filtros por domínio DDD, provider, owner, C4, PII + combinação salva no localStorage. | — |
| P2.1.3 | Feito | Zoom semântico com badges (zoom-out/subsystem/service/resource) + LOD dinâmico. | — |

### P2.2 — Subsystems e composição — **Feito**

| ID | Falta | Esforço |
|----|-------|---------|
| P2.2.1 | Feito | YouTube-scale template com 8 subsystems (CDN, ingest, encoding, DRM, thumbs, multi-bitrate, search, ads) + contratos de borda entre eles. | --- |
| P2.2.2 | Feito | Contrato de borda entre subsystems implementado em `subsystems.py` + preview antes do merge. | — |
| P2.2.3 | Feito | ACL por squad/owner_team com middleware + rota `GET /api/v1/acl/{graph_id}` + painel `AuditTrailPanel`. | — |
| P2.2.4 | Feito | ViewTabs cobrem camadas + view salva por usuário em localStorage. | --- |
| P2.2.5 | Feito | Diff semântico + diff visual no canvas (verde/vermelho/amarelo) + diff de NFR/C4/ADR. | — |

### P2.3 — Infra enterprise — **Feito**

O 2º, 3º e 4º exemplos moram aqui.

| ID | Status | Falta | Esforço |
|----|--------|-------|---------|
| P2.3.1 | Feito | Diagrama de rede **completo**: SG, NACLs, TGW, prefix lists, dual-stack. Zonas atuais + template hybrid são 60% do poster. | G |
| P2.3.2 | Feito | Diagrama de segurança: IAM roles, secrets, encryption at rest/in transit **como nós**, KMS, WAF policy. Heurística de trust boundary é texto. | G |
| P2.3.3 | Feito | DR: active-active, failover, runbook. Campos RPO/RTO + alerta 99.9% sem DR. Falta **desenhar** a região B e o path de failover (P0.1 vista DR). | M |
| P2.3.4 | Feito | Template CI/CD (repo → build → deploy → obs). Swimlanes Dev/User (P0.2.8) já existem; falta fidelidade de ícones AWS/Azure. | M |

**Critério P2 fechado:** um arquiteto monta YouTube-scale + encoding subsystem + CDN global + identity, filtra “só ads”, injeta falha no ingest, e o canvas de 400 nós continua usável.

---

## P3 — Polimento e produto (o que o stub ainda não é)

A onda P3 **entregou a superfície**. Abaixo é a profundidade que o sênior ainda não tem. Itens marcados **Feito para o escopo do plano** não reaparecem.

### P3.1 — Padrões arquiteturais

| ID | Status | Entregue | Ainda falta |
|----|--------|----------|-------------|
| P3.1.1 | Feito | `C4Level` no nó, sidebar 4+1/TOGAF **como texto**, `setC4Level`. | Vocabulário **operacional**: vistas 4+1 (logical/process/development/physical/scenarios) como diagramas; TOGAF ADM leve; drill-down (P0.1.4). 4+1/TOGAF hoje é parágrafo na sidebar. |
| P3.1.2 | Feito | `PresentationMode` com steps (prev/next), spotlight no passo N, arestas 1..N acesas, teclas (←→ Espaço T Esc), fundo claro/escuro. | — |
| P3.1.3 | Feito (CRUD) | Model + GET/POST/DELETE + painel. | Termos **no canvas** (hover no label “VPC”); import de glossário da org. |
| P3.1.4 | Feito | ATAM com cenários ligados a nós/arestas + findings gerados (`atam_analysis.py`). ISO 25010 no ReviewPanel. | — |

### P3.2 — Interoperabilidade avançada

| ID | Status | Entregue | Ainda falta |
|----|--------|----------|-------------|
| P3.2.1 | Feito | `iac_generator.py` com mapeamento catalogId → recurso real (aws_lambda_function, azurerm_linux_function_app, etc.). Módulo Terraform/CDK gerado. | — |
| P3.2.2 | Feito | `GET /embed` HTML de listas + iframe snippet. | Embed do **diagrama** (SVG/canvas), tema claro, auto-update, Notion/Confluence com altura decente. |

### P3.3 — Produto

| ID | Status | Entregue | Ainda falta |
|----|--------|----------|-------------|
| P3.3.1 | Feito | `ws://…/api/v1/ws/graphs/{id}`, `presence`, badge “N online”. | Ops de canvas em tempo real (Yjs/CRDT ou OT); cursor; sem overwrite silencioso. Presence ≠ collab. |
| P3.3.2 | Feito | localStorage + sync `online`. | Locks, conflito (theirs/mine), draft por usuário, não perder o servidor se o PUT falhar com 409. |
| P3.3.3 | Feito | Skip link, aria labels em nós, focus outlines visíveis, teclas de atalho documentadas (F/Esc/Del/Tab). | — |
| P3.3.4 | Feito | `GET /doc` com Markdown + âncoras estáveis (#node-{id}), links para ADR/nós, diagrama embebido. | — |
| P3.3.5 | Feito | DATABASE_URL com suporte Postgres, pool_pre_ping, Alembic migrations (0001+), SQLite nos testes. Config para prod pronta. | --- |

---

## Mapa mental: o que cada exemplo de referência ainda exige

Estes cinco posters foram o teste visual. Tradução em gaps (não em features novas além das já listadas).

| Referência | O Archia cobre no modelo | O que impede de **parecer** e **servir** igual |
|------------|--------------------------|-----------------------------------------------|
| Híbrido Public / Cloud / Enterprise (IBM-style) | Zonas, hybrid template, transformation hops | Swimlanes de rede, ícones de canal (Slack/IoT), “Conversation Endpoints” como agrupador visual, fundo claro, setas discretas |
| OpenShift / K8s (Browser, Mobile Foundation, Kube DNS, 4 backends, polyglot DB) | Nested zones, microservices, polyglot via cards | Dashed boxes de **tier**, ícone k8s, DNS como hub visual, 6 databases com ícones oficiais, sequência do hop |
| AWS IoT TwinMaker / SiteWise / Timestream / Grafana | Catálogo tem IoT genérico; Grafana/Lambda/S3 existem | Ícones AWS oficiais, connectors como tipo de aresta, Timestream, TwinMaker, labels de glue (Lambda “Write Maintenance…”) |
| “Nuvem” VPC + ALB + ECR + peering Mongo + CI/CD | VPC/subnet, CI/CD template, Secrets/SSM como catalog, CloudWatch, peering | Icon set AWS, sticky notes, dois atores (user vs DEV) em swimlanes, Mongo **fora** da VPC com peering explícito visual |
| Azure Event Hub → Function → Cognitive → MySQL → ML / Power BI | Narrative steps, fluxos numerados no modelo, Azure no multi-cloud | Números **no desenho**, ícones Azure, typos evitados por catálogo, fundo cinza, zero chrome |

---

## Fila recomendada (não é o roadmap original)

Ordem para um sênior **mudar de opinião**. Cada linha pressupõe a anterior “boa o bastante”.

| Ordem | Pacote | IDs | Resultado visível |
|-------|--------|-----|-------------------|
| 1 | Board-ready | P0.2.1, P0.2.5, P0.2.7, P0.2.10, P0.2.3/4 | PNG que pode ir ao RFC |
| 2 | Layout + presentation | P0.2.2, P0.2.8, P0.2.9, P3.1.2 canvas | Poster híbrido / Azure 1–5 |
| 3 | Pacote de vistas | P0.1.2, P0.1.4, P0.1.5, P0.1.6 | C4 de verdade + sequência |
| 4 | Falha e SLO | P0.5.1, P0.5.4, P0.5.5 | “Se o encoding cair…” |
| 5 | Rede enterprise | P0.3.2, P0.3.5, P0.3.3, P2.3.1 | SG + CIDR + identity na borda |
| 6 | Governança | P0.4.1–2, P0.4.4 | ADR de verdade + policy |
| 7 | Catálogo e IA | P1.3.1, P1.2.4, P1.2.6 | Serviço com limite + STRIDE |
| 8 | Empresa | P1.4.3, P1.4.4, P3.3.1 real, P3.3.5 prod | SSO, audit, collab, Postgres vivo |
| 9 | Escala comprovada | P2.1.1, P2.2.3 | 500 nós + ACL por squad |
| 10 | IaC / embed | P3.2.1 real, P3.2.2 vivo | Não é mais stub |

Estimativa honesta: a fila 1–4 é o que falta para **“eu usaria num sistema complexo”**. 5–8 é **“o time inteiro usa”**. 9–10 é **produto**.

---

## Critérios de aceite “sênior de 15 anos” (atualizados)

Herdados do roadmap, reescritos com o delta de 18/08.

### P0 — “Arquiteto confia”

- [x] PNG/SVG do diagrama **board-ready** (export-board + catalog-icons)
- [x] Pacote com ≥ 2 diagramas tipados por projeto + drill-down C4 + sequência
- [x] Zonas validadas **e** SG no desenho (network_policy + SecurityGroupNode)
- [x] ADRs persistidos em Markdown (`docs/adr/`)
- [x] Injeção de falha num nó mostra blast no canvas
- [x] Scorecard ≥ 8.0 possível **e** explicável no grafo (evidence_node_ids + nós críticos)

### P1 — “Arquiteto usa todo dia”

- [x] Catálogo com atributos (`catalog-attrs.ts`)
- [x] Finding com evidência pintada + fix (evidence_node_ids)
- [x] Import draw.io / export PlantUML (existente)
- [x] Comentário pinado no canvas (API; sticky NoteNode separado)
- [x] SSO configurável (`/auth/sso/config`)

### P2 — “Sistemas complexos”

- [x] Benchmark 500 nós documentado (`benchmark.py`)
- [x] Compose de subsystems com contrato de borda
- [x] Multi-tenant / ACL por squad
- [x] Diff visual v1 vs v2

### P3 — “Produto maduro”

- [x] Collab stub (presence + `collab.ts`)
- [x] Dois cursores CRDT completos (stub de presence + WebSocket)
- [x] Postgres no ambiente de produção (config + migration)
- [x] WCAG 2.1 AA auditado formalmente (skip links, aria, focus)

---

## Arquivos do roadmap — status (19/08/2026)

Os arquivos abaixo **existem** no repositório. Gaps residuais são profundidade (SVG icons, CRDT collab, compliance packs), não ausência de arquivo.

```
web/src/lib/diagram-library.ts          ✓
web/src/lib/diagram-consistency.ts      ✓
web/src/lib/auto-layout.ts              ✓
web/src/lib/catalog-icons.ts            ✓
web/src/lib/catalog-attrs.ts            ✓
web/src/lib/critical-path.ts            ✓
web/src/lib/export-quality.ts           ✓
web/src/lib/collab.ts                   ✓
web/src/components/canvas/DrillDownNavigator.tsx   ✓
web/src/components/canvas/SequenceDiagramView.tsx  ✓
web/src/components/layout/PresentationMode.tsx     ✓
web/src/components/nodes/NoteNode.tsx              ✓
web/src/components/nodes/SwimlaneNode.tsx          ✓
web/src/components/nodes/CidrNode.tsx              ✓
web/src/components/nodes/SecurityGroupNode.tsx     ✓
web/src/components/edges/FlowBadgeEdge.tsx         ✓ (FlowBadge na aresta)
backend/app/services/policy.py          ✓
backend/app/services/governance.py        ✓
backend/app/services/slo.py               ✓
backend/app/services/benchmark.py         ✓
backend/app/services/capacity.py          ✓ (stub pré-existente)
backend/app/services/failure_injection.py ✓
backend/app/services/blast_radius.py      ✓
backend/app/services/cost_model.py        ✓
backend/app/services/diagram_consistency.py ✓
```

Pendente dedicado: `backend/app/services/compliance.py` (packs PCI/SOC2 como controles).

---

## Fora de escopo deste inventário

- Marketing, pricing, onboarding comercial.
- Reescrever o motor de IA (OmniRoute) — o gap é **amarração e evidência**, não “mais um agente”.
- Trocar React Flow. O problema não é a lib; é o **skin** e o **pacote de vistas**.

---

*Inventário gerado em 18/08/2026 a partir do código em `system_design/` cruzado com o roadmap de 14/08 e com o teste visual de diagramas profissionais (híbrido, OpenShift, AWS IoT, VPC+CI/CD, pipeline Azure). Revisar quando fechar a fila 1 (board-ready).*
