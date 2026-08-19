# Gaps Archia — o que falta para um arquiteto sênior confiar

**Data:** 18/08/2026  
**Status:** P0 misto (P implementado, M polido, G stub com arquitetura) entregue em código — ver [p0-board.md](./features/p0-board.md). P1–P3 continuam no inventário abaixo.  
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

#### P0.1.2 — `DiagramLibrary` de vistas nomeadas — **Parcial / Ausente**

| | |
|--|--|
| **Falta** | Coleção tipada por papel: Context, Application, Data, Runtime, Security, DR — cada uma um `graph_id`, com metadado `diagram_kind`. Hoje o projeto é uma pasta de grafos genéricos. |
| **Por quê** | O 1º exemplo (Public / Cloud / Enterprise) e o 2º (OpenShift em camadas) são **vistas**, não um único emaranhado. O sênior troca de folha, não de filtro. |
| **Aceite** | Criar projeto pré-cria (ou oferece) as 5–6 vistas; sidebar mostra o tipo; consistência de IDs entre elas (ver P0.1.6). |
| **Arquivos** | `web/src/lib/diagram-library.ts`, `web/src/lib/types.ts` (`DiagramKind`), coluna `graphs.diagram_kind`. |
| **Esforço** | M |

#### P0.1.4 — C4 drill-down — **Ausente** (o P3.1.1 não substitui)

| | |
|--|--|
| **Falta** | `DrillDownNavigator`: clicar um container abre o diagrama de componentes; breadcrumb Context → Container → Component; IDs estáveis entre níveis. |
| **Hoje** | Select “C4 · Container” no nó. O canvas não muda de nível. |
| **Por quê** | YouTube não se desenha num único C4. O sênior desce e sobe. Rótulo no card não é C4. |
| **Aceite** | Dois grafos ligados; navegação ida e volta sem perder seleção; export do pacote inclui os três níveis. |
| **Arquivos** | `web/src/components/canvas/DrillDownNavigator.tsx`, relação `graphs.parent_graph_id` / `graphs.c4_parent_node_id`. |
| **Esforço** | G |

#### P0.1.5 — Diagrama de sequência — **Ausente**

| | |
|--|--|
| **Falta** | Vista temporal do request path (lifelines = nós do grafo; mensagens = arestas numeradas). PlantUML sequence no export existe como **texto gerado**, não como canvas editável. |
| **Por quê** | O 2º exemplo (Browser → Public route → Kube DNS → backends → DBs) é lido como **tempo**. Grafo estático não substitui. |
| **Aceite** | Aba ou modo “Sequência” gerado a partir de `flowNumber`; edição de mensagens; export PlantUML fiel ao que está na tela. |
| **Arquivos** | `web/src/components/canvas/SequenceDiagramView.tsx`. |
| **Esforço** | G |

#### P0.1.6 — Cross-diagram consistency — **Ausente**

| | |
|--|--|
| **Falta** | Validação: o serviço `Orders` no contexto existe no runtime e no dados; rename propaga ou alerta órfão. |
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

#### P0.2.1 — Ícones oficiais AWS / Azure / GCP — **Ausente**

| | |
|--|--|
| **Falta** | Pacote SVG do Architecture Icons (AWS 2019/2023, Azure, GCP) mapeado por `catalogId`. O sênior reconhece ALB, CloudFront, Event Hubs, Function Apps em 200ms. Simple Icons não é esse alfabeto. |
| **Aceite** | Modo “ícone oficial” vs “ícone compacto”; export PNG usa o oficial; catálogo IoT (SiteWise, TwinMaker, IoT Core) com o desenho certo. |
| **Arquivos** | `web/src/lib/catalog-icons.ts` + assets versionados (licença de uso dos icon sets). |
| **Esforço** | M–G (volume + licença) |

#### P0.2.2 — Auto-layout por zonas — **Ausente**

| | |
|--|--|
| **Falta** | `auto-layout.ts`: Edge → Public → Private → Data (ou Public Network / Cloud / Enterprise como o 1º exemplo). Sem isso, 80 nós viram cabelo. |
| **Aceite** | Um clique “Organizar”; filhos permanecem nas zonas; undo. |
| **Esforço** | M |

#### P0.2.3 / P0.2.4 — Title block e legenda profissionais — **Parcial**

| | |
|--|--|
| **Falta** | Title block **dentro do artefato exportado** (não overlay `fixed` do editor): título, autor, versão, data, classificação, provider. Legenda de fluxos/zonas no PNG/PDF, cantos padronizados, fundo do diagrama (não da UI). |
| **Hoje** | Componentes úteis na tela; somem ou poluem o export. |
| **Esforço** | P–M |

#### P0.2.5 — Fluxos numerados visuais — **Parcial**

| | |
|--|--|
| **Falta** | `FlowBadge` na aresta (①②③), seta por protocolo (HTTPS vs Kafka vs SQL), espessura para path crítico. O 5º exemplo (Azure 1–5) é exatamente isso. |
| **Hoje** | `flowNumber` no modelo e no painel; a aresta não conta a história sozinha. |
| **Esforço** | P–M |

#### P0.2.6 — Path crítico destacado — **Parcial**

| | |
|--|--|
| **Falta** | Highlight de caminho (nós + arestas) ao selecionar “caminho feliz” / “caminho de falha”; cálculo opcional a partir de `isCriticalPath`. |
| **Arquivos** | `web/src/lib/critical-path.ts`. |
| **Esforço** | P |

#### P0.2.7 — Notas / sticky — **Ausente**

| | |
|--|--|
| **Falta** | `NoteNode` no canvas (amarelo, texto livre, âncora opcional a um nó). O 4º exemplo vive disso. Comentários da API **não** aparecem como sticky. |
| **Esforço** | P |

#### P0.2.8 — Swimlanes first-class — **Parcial**

| | |
|--|--|
| **Falta** | Nó `Swimlane` (Control / Data / Management) com regras de drop, não só `zoneKind: plane`. Visual de faixa horizontal como o 2º exemplo (FRONTEND / BACKEND / DATABASE). |
| **Esforço** | M |

#### P0.2.9 — Modo presentation — **Parcial**

| | |
|--|--|
| **Falta** | Palco: fundo claro opcional, sem âncoras, sem MiniMap, teclas só narrativa (próximo fluxo). Focus mode atual só esconde sidebars no tema escuro. |
| **Esforço** | P |

#### P0.2.10 — Export PNG/SVG/PDF quality — **Parcial**

| | |
|--|--|
| **Falta** | Fundo claro/escuro selecionável; SVG vetorial; PDF com title block + legenda + scorecard em páginas; **zero** chrome (handles, resize, recommendation banner). |
| **Hoje** | `html-to-image` do viewport escuro; PDF via print HTML. |
| **Arquivos** | `web/src/lib/export-quality.ts` (ainda não existe). |
| **Esforço** | M |

**Critério P0.2 fechado:** um arquiteto exporta o template VPC+ALB+ECR (exemplo “Nuvem”) e um colega **não pergunta em qual ferramenta foi feito** — pergunta se a subnet privada está correta.

---

### P0.3 — Rede e limites profundos

**O que existe hoje**

- Nesting rígido em `zones.ts` (Region → VPC → AZ → subnet; peering/VPN/PrivateLink/ExpressRoute).
- Heurística: dado em subnet pública = critical; VPC sem privada; uma AZ; edge+compute sem AuthZ.
- `firewallRules` na aresta (porta/protocolo/direção) — não é Security Group.
- Catálogo multi-cloud (DNS, API edge, WAF-ish via tags) e `catalog-network.ts` (~11 itens).
- Template `hybrid-network`.

#### P0.3.2 — Security Groups / NSG — **Ausente**

| | |
|--|--|
| **Falta** | Entidade `SecurityGroupNode` (ou zona) com regras inbound/outbound, attach a ENI/subnet/card; validação “ALB:443 público → ECS:8080 só do SG do ALB”. |
| **Hoje** | Lista de regras na aresta; o 4º exemplo mostra isolamento por subnet, não a matriz de SG. |
| **Esforço** | G |

#### P0.3.3 — Identity na borda — **Parcial**

| | |
|--|--|
| **Falta** | Cards WAF, API Gateway, mTLS, OAuth/OIDC com **atributos** (issuer, audience, authorizer tipo, WAF managed rules). Heurística “sem AuthZ” não substitui o desenho do 2º exemplo (Auth + Kube DNS). |
| **Esforço** | M |

#### P0.3.4 — Peering / Transit / Hybrid — **Parcial**

| | |
|--|--|
| **Falta** | Transit Gateway / Virtual WAN como **hub**; Cloud ↔ Enterprise Network como o 1º exemplo (Transformation & Connectivity nos dois lados). Hoje peering/VPN/PrivateLink são zone kinds — corretos, rasos. |
| **Esforço** | M |

#### P0.3.5 — CIDR — **Ausente**

| | |
|--|--|
| **Falta** | Campo opcional CIDR na subnet/VPC; overlap detector; `CidrNode` se fizer sentido visual. |
| **Esforço** | P–M |

#### P0.3.6 — Edge global como topologia — **Parcial**

| | |
|--|--|
| **Falta** | CloudFront/CDN/PoPs como **malha** (vários edges, origem, behaviors), não um card. Template YouTube-scale tem CDN, mas não topologia global. |
| **Esforço** | M |

#### P0.3.7 — Isolamento tenant — **Ausente**

| | |
|--|--|
| **Falta** | Boundary multi-tenant (pool vs silo vs bridge) para marketplace/fintech. |
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

#### P0.4.1 / P0.4.2 — ADR editável e decision log — **Parcial**

| | |
|--|--|
| **Falta** | CRUD persistido (não só derivado do canvas); status `deprecated`; autor, data, links para issue; “por que **não** usamos X”; versionamento do texto. |
| **Hoje** | Regenera a cada análise; raso; o sênior não governa decisão assim. |
| **Aceite** | Tabela `adrs`; edição no painel sobrevive reload; ADR-003 continua existindo se o card mudar de nome. |
| **Esforço** | M |

#### P0.4.3 — Architecture Package — **Parcial**

| | |
|--|--|
| **Falta** | PDF/MD com **quatro vistas** de verdade (quando P0.1 existir) + ADRs governados + scorecard. Hoje é um MD do grafo único. Doc viva P3 ajuda, não fecha o pacote. |
| **Esforço** | M (depende P0.1) |

#### P0.4.4 — Policy as code — **Ausente**

| | |
|--|--|
| **Falta** | `backend/app/services/policy.py`: regras da org (“PII só em private + KMS”, “sem RDS público”). Findings com `policy_id`. |
| **Esforço** | M |

#### P0.4.5 — Compliance packs — **Ausente** (além dos chips)

| | |
|--|--|
| **Falta** | `compliance.py`: PCI/SOC2/HIPAA/LGPD como **controles** mapeados a nós (cifra em trânsito, retenção, DBA access). Chip “PCI” no NFR não audita o grafo. |
| **Esforço** | G |

#### P0.4.6 — RACI — **Parcial**

| | |
|--|--|
| **Falta** | R/A/C/I por serviço (não só `owner_team` no diagrama). |
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

#### P0.5.1 — SLI/SLO por serviço — **Ausente**

| | |
|--|--|
| **Falta** | Error budget, burn rate, SLI (disponibilidade, latência, correção) **no card**, não só no NFR do projeto. |
| **Por quê** | YouTube: SLO do ingest live ≠ SLO do ads auction. |
| **Esforço** | M |

#### P0.5.2 — Capacity planning — **Stub**

| | |
|--|--|
| **Falta** | `capacity.py`: sharding, partições, hot keys, fan-out, backpressure — amarrado ao grafo (este tópico Kafka, este shard key). |
| **Hoje** | Tabela `COMPONENT_CAPACITY_RPS` + saturação. Bom para demo, fraco para encoding farm. |
| **Esforço** | G |

#### P0.5.3 — Multi-região / RTT — **Ausente**

| | |
|--|--|
| **Falta** | RTT entre regiões no modelo; finding “chamada síncrona us-east ↔ ap-south no path crítico”. Zonas `region` existem sem latência. |
| **Esforço** | M |

#### P0.5.4 — Failure injection — **Ausente**

| | |
|--|--|
| **Falta** | Ação “derruba este nó”: o que deixa de responder, o que entra em fallback, o que está no path crítico. Simulação de **evento aleatório** (timeout de pagamento) ≠ injeção no componente selecionado. |
| **Arquivos** | `backend/app/services/failure_injection.py`. |
| **Esforço** | M |

#### P0.5.5 — Blast radius — **Stub**

| | |
|--|--|
| **Falta** | Grafo de dependência + blast (N hops, % de jornadas quebradas, tenants afetados). UI no canvas (nós em vermelho). |
| **Hoje** | Multiplicador na simulação se há bottlenecks. |
| **Arquivos** | `backend/app/services/blast_radius.py`. |
| **Esforço** | M–G |

#### P0.5.6 — Circuit breakers — **Parcial**

| | |
|--|--|
| **Falta** | Breaker como nó ou decorador de aresta com threshold, fallback target. `failureBehavior` é um enum, não um componente. |
| **Esforço** | P |

#### P0.5.7 — Cost model — **Stub**

| | |
|--|--|
| **Falta** | Custo por serviço/região/tier (não um número mágico mensal). Ligado ao catálogo (P1.3.1). |
| **Arquivos** | `backend/app/services/cost_model.py`. |
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
| P1.1.1 | Ownership ≠ mesh | Bounded context no canvas (não só tabela); quem **escreve** vs lê; data mesh como zona. | M |
| P1.1.2 | Contratos de verdade | Anexar OpenAPI/AsyncAPI na aresta/serviço (arquivo ou URL), não só “REST /v1/users”. Validar que o fluxo existe no spec. | G |
| P1.1.3 | Event catalog | Schema registry, versão, DLQ como **nó**, retenção amarrada ao tópico Kafka real do desenho. Hoje: nome + protocolo + horas. | M |
| P1.1.4 | Sagas / outbox | Padrão por domínio no grafo (não só select strong/eventual numa chave livre). | M |
| P1.1.5 | Classificação no store | PII/LGPD **no database card** e no fluxo (este hop carrega PII). Retention no ownership é um número. | M |
| P1.1.6 | Polyglot map | Vista “qual serviço usa qual DB” gerada (matriz), não só lineage lista. | P |
| P1.1.7 | Lineage visual | Aba é lista source→target. Falta grafo de pipeline (exemplo Azure: Event Hub → Function → MySQL → ML/Power BI). | M |

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
| P1.2.1 | Parcial | Todo finding com **fix sugerido** acionável (aplicar zona / adicionar card). Nem todo finding tem remediação de um clique. | M |
| P1.2.2 | Parcial | Matriz de FPs revisada com sênior (Next.js, BFF, CDN). Regras atuais são um começo. | M |
| P1.2.3 | Parcial | Benchmarks por domínio **visíveis** na UI e no score; calibrar com números reais (fintech p99, IoT ingest). | M |
| P1.2.4 | Ausente | “Por que 6.2”: highlight dos nós/arestas que puxaram cada eixo do scorecard. | M |
| P1.2.5 | Parcial | Cenários de simulação **persistidos no grafo** (não só preset global). Região down / cold start como injeção (liga P0.5.4). | M |
| P1.2.6 | Ausente | STRIDE / LINDDUN: ameaças por nó e por trust boundary. | G |
| P1.2.7 | Ausente | Well-Architected (AWS/Azure/GCP) como scorecard paralelo ao review_scorecard. | G |

---

### P1.3 — Catálogo rico

**O que existe hoje:** ~240 itens somando `catalog.ts` + multi-cloud + patterns + network. Patterns (CQRS, saga, BFF, strangler, sidecar…) são **cards de texto**. Templates de referência (serverless API, multi-AZ, data pipeline, YouTube-scale, CI/CD, hybrid). Sem catálogo privado da org. Sem limites/RPS/HA/região/pricing no tipo `CatalogItem`.

| ID | Status | Falta | Esforço |
|----|--------|-------|---------|
| P1.3.1 | Ausente | Atributos reais: `limits`, `ha_model`, `regions`, `pricing_tier`, `rps_guidance`. Roadmap pedia 500+ serviços; quantidade sem atributo não convence. | G |
| P1.3.2 | Parcial | Patterns library **aplicável** (soltar “saga” materializa orquestrador + DLQ + outbox), não um card “Saga”. | M |
| P1.3.3 | Parcial | Reference architectures **profundas** (Well-Architected) — templates atuais são bons sketches, não o poster oficial. | G |
| P1.3.4 | Ausente | Catálogo privado da empresa (CRUD, ACL). | G |
| P1.3.5 | Ausente | Contrato de capacidade no card (“aguenta X RPS / Y TB”) editável, usado pela simulação. | M |

---

### P1.4 — Colaboração básica

**O que existe hoje:** comentários por `graph_id` + `node_id` (API + painel). Review humano (status + comentário). Presence WebSocket (P3). Auth local (JWT, roles senior/other). Sem mentions, SSO, audit, Jira.

| ID | Status | Falta | Esforço |
|----|--------|-------|---------|
| P1.4.1 | Parcial | Comentário **no canvas** (pin, thread, resolver) estilo Figma — não só lista no inspetor. | M |
| P1.4.2 | Ausente | @mentions, assignee, “revisar path crítico”. | M |
| P1.4.3 | Ausente | SSO/SAML/OIDC. Empresa real não usa user/senha local. | G |
| P1.4.4 | Ausente | Audit trail (quem mudou nó/aresta/NFR). Versões de grafo não são compliance. | G |
| P1.4.5 | Parcial | Template de design review (agenda + checklist + scorecard obrigatório ≥ 8). Scorecard existe; o rito não. | P |
| P1.4.6 | Ausente | Link Jira/Confluence ↔ ADR ↔ diagrama. | M |

---

### P1.5 — Interoperabilidade

**O que existe hoje:** JSON reimportável, PNG escuro, MD package, PDF print, draw.io XML, PlantUML, Mermaid, IaC stub (P3), embed HTML lista (P3), C4 como campo no nó (não export C4-PlantUML estruturado).

| ID | Status | Falta | Esforço |
|----|--------|-------|---------|
| P1.5.1 | Parcial | Mesmo que P0.2.10 — export **sem chrome**, com legenda e title block. | M |
| P1.5.2 | Parcial | Export draw.io existe; **import** draw.io (o arquiteto já tem 200 diagramas) **não**. | G |
| P1.5.3 | Feito o suficiente | PlantUML/Mermaid export. Gap residual: round-trip e sequência editável (P0.1.5). | — |
| P1.5.4 | Ausente | Export C4-PlantUML / structurizr (`System_Boundary`, `Container`) a partir de `c4Level`. | M |
| P1.5.5 | Stub | Embed é snapshot HTML de listas. “Diagrama vivo” = iframe do canvas (ou SVG atualizado) com zoom. Ver P3.2.2. | M |

---

## P2 — Escala (YouTube / fintech / IoT industrial)

**O que existe hoje (não listar de novo como gap):** virtualização do canvas ≥ 80 nós, search/filter, ViewTabs (storage/auth/media/search/rede/CI-CD), foco em zona (`fitView` subtree), subsystems + compose, `owner_team`, views filtráveis, diff semântico, zonas de rede, heurística trust/DR, RPO/RTO, template CI/CD.

### P2.1 — Performance em grande escala — **Parcial**

| ID | Falta | Aceite | Esforço |
|----|-------|--------|---------|
| P2.1.1 | 100–1000+ nós **sem lag percebido** (drag, snap, análise). Hoje: `onlyRenderVisibleElements` ≥ 80, snap off ≥ 120. Não há prova com 500 nós densos + zonas aninhadas. | Benchmark documentado: 500 nós / 700 arestas, drag 60fps, analyze < 3s. Clustering/minimap LOD. | G |
| P2.1.2 | Filtros por **domínio DDD, provider, owner, C4, PII**. Search atual cobre query/kind/layer/zona. | Combinação salva (“só ads + PII”). | P |
| P2.1.3 | Layers de zoom semânticos (não só `minZoom: 0.08`): nível 1 = subsistemas, nível 2 = serviços, nível 3 = recursos. Liga ao C4 drill-down. | Scroll/zoom troca LOD de labels. | M |

### P2.2 — Subsystems e composição — **Parcial**

| ID | Falta | Esforço |
|----|-------|---------|
| P2.2.1 | YouTube-scale template é **mapa**. Faltam os 8 subsystems como pacotes editáveis profundos (encoding com filas, DRM, thumbs, multi-bitrate). | G |
| P2.2.2 | Import CDN/identity/search existe. Falta **contrato de borda** entre subsystems (quais APIs/eventos atravessam) e preview antes do merge. | M |
| P2.2.3 | `owner_team` ≠ workspace multi-time com ACL (squad só edita o bounded context). | G |
| P2.2.4 | ViewTabs cobrem camadas. Falta view **salva por usuário** e “só media pipeline” como grafo derivado, não só hide. | P |
| P2.2.5 | Diff semântico existe (nós/arestas). Falta diff **visual** no canvas (verde/vermelho) e diff de NFR/C4/ADR. | M |

### P2.3 — Infra enterprise — **Parcial**

O 2º, 3º e 4º exemplos moram aqui.

| ID | Status | Falta | Esforço |
|----|--------|-------|---------|
| P2.3.1 | Parcial | Diagrama de rede **completo**: SG, NACLs, TGW, prefix lists, dual-stack. Zonas atuais + template hybrid são 60% do poster. | G |
| P2.3.2 | Parcial | Diagrama de segurança: IAM roles, secrets, encryption at rest/in transit **como nós**, KMS, WAF policy. Heurística de trust boundary é texto. | G |
| P2.3.3 | Parcial | DR: active-active, failover, runbook. Campos RPO/RTO + alerta 99.9% sem DR. Falta **desenhar** a região B e o path de failover (P0.1 vista DR). | M |
| P2.3.4 | Parcial | Template CI/CD (repo → build → deploy → obs). O 4º exemplo tem Bitbucket → CodeBuild → ECR → serviços + CloudWatch. Falta fidelidade de ícones e o **segundo fluxo** (dev vs user) no mesmo canvas sem bagunça (swimlanes P0.2.8). | M |

**Critério P2 fechado:** um arquiteto monta YouTube-scale + encoding subsystem + CDN global + identity, filtra “só ads”, injeta falha no ingest, e o canvas de 400 nós continua usável.

---

## P3 — Polimento e produto (o que o stub ainda não é)

A onda P3 **entregou a superfície**. Abaixo é a profundidade que o sênior ainda não tem. Itens marcados **Feito para o escopo do plano** não reaparecem.

### P3.1 — Padrões arquiteturais

| ID | Status | Entregue | Ainda falta |
|----|--------|----------|-------------|
| P3.1.1 | Stub | `C4Level` no nó, sidebar 4+1/TOGAF **como texto**, `setC4Level`. | Vocabulário **operacional**: vistas 4+1 (logical/process/development/physical/scenarios) como diagramas; TOGAF ADM leve; drill-down (P0.1.4). 4+1/TOGAF hoje é parágrafo na sidebar. |
| P3.1.2 | Parcial | `NarrativeView`, `narrative_steps`, prev/next, pin no nó. | Modo canvas: spotlight no passo N, arestas 1..N acesas, presentation (P0.2.9). O 5º exemplo **é** narrative mode no desenho. |
| P3.1.3 | Feito (CRUD) | Model + GET/POST/DELETE + painel. | Termos **no canvas** (hover no label “VPC”); import de glossário da org. |
| P3.1.4 | Parcial | Aba ATAM, `quality_scenarios` no NFR. | Ligar cenário ao **nó/aresta**; gerar finding se o estímulo não tem resposta no grafo; ISO 25010 completo (não só um select de atributo). |

### P3.2 — Interoperabilidade avançada

| ID | Status | Entregue | Ainda falta |
|----|--------|----------|-------------|
| P3.2.1 | Stub | `generate_terraform` / `generate_cdk` → `null_resource` / `CfnOutput`. | Mapeamento catalogId → recurso real (aws_lambda_function, azurerm_linux_function_app); módulos; **nunca** aplicar sem revisão (já avisa). Sem isso o sênior trata como brinquedo. |
| P3.2.2 | Stub | `GET /embed` HTML de listas + iframe snippet. | Embed do **diagrama** (SVG/canvas), tema claro, auto-update, Notion/Confluence com altura decente. |

### P3.3 — Produto

| ID | Status | Entregue | Ainda falta |
|----|--------|----------|-------------|
| P3.3.1 | Stub | `ws://…/api/v1/ws/graphs/{id}`, `presence`, badge “N online”. | Ops de canvas em tempo real (Yjs/CRDT ou OT); cursor; sem overwrite silencioso. Presence ≠ collab. |
| P3.3.2 | Stub | localStorage + sync `online`. | Locks, conflito (theirs/mine), draft por usuário, não perder o servidor se o PUT falhar com 409. |
| P3.3.3 | Parcial | aria no canvas, F/Esc/Del/Tab. | WCAG 2.1 AA: contraste do tema escuro, foco visível em todos os controles, screen reader nos nós (nome + zona + C4), atalhos documentados na UI, skip links. Tab ciclar nós **não** é AA. |
| P3.3.4 | Parcial | `GET /doc` Markdown (contexto, NFR, ATAM, componentes, fluxos, glossário). | Wiki viva: âncoras estáveis, links para ADR/node, atualizar Confluence, diagrama embebido. |
| P3.3.5 | Parcial | `DATABASE_URL` (AliasChoices), `pool_pre_ping`, Alembic 0001 (`projects`, `comments`, `glossary_terms`, `narrative_json`), SQLite nos testes. | **Rodar** Postgres em staging/prod, job de migrate, backup, RLS/tenant, desligar SQLite file no deploy. Config ≠ migração feita. |

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

- [ ] PNG/SVG do diagrama **board-ready** (ícones oficiais, sem chrome, title block no artefato)
- [ ] Pacote com ≥ 2 diagramas tipados por projeto + drill-down C4 ou sequência
- [ ] Zonas validadas **e** SG ou equivalente no desenho (DB public continua erro)
- [ ] ADRs persistidos, editáveis, com “por que não X”
- [ ] Injeção de falha num nó mostra blast no canvas
- [ ] Scorecard ≥ 8.0 possível **e** explicável no grafo

### P1 — “Arquiteto usa todo dia”

- [ ] Catálogo com atributos (limite/HA/região), não só 240 nomes
- [ ] Finding com evidência pintada + fix
- [ ] Import draw.io **ou** C4-PlantUML export estruturado
- [ ] Comentário pinado no canvas
- [ ] SSO configurável

### P2 — “Sistemas complexos”

- [ ] Benchmark 500 nós documentado
- [ ] Compose de subsystems com contrato de borda
- [ ] Multi-tenant / ACL por squad
- [ ] Diff visual v1 vs v2

### P3 — “Produto maduro”

- [ ] Dois cursores no mesmo grafo sem perder edição
- [ ] Conflito de draft resolvível
- [ ] Postgres no ambiente de produção (não só `DATABASE_URL` no `.env.example`)
- [ ] WCAG 2.1 AA auditado (não só Tab no canvas)

---

## Arquivos que o roadmap pedia e **ainda não existem**

Lista objetiva para não redescobrir na próxima sprint.

```
web/src/lib/diagram-library.ts
web/src/lib/diagram-consistency.ts
web/src/lib/auto-layout.ts
web/src/lib/catalog-icons.ts
web/src/lib/critical-path.ts
web/src/lib/export-quality.ts
web/src/components/canvas/DrillDownNavigator.tsx
web/src/components/canvas/SequenceDiagramView.tsx
web/src/components/canvas/Legend.tsx          # existe DiagramLegend; não o poster
web/src/components/layout/PresentationMode.tsx
web/src/components/nodes/NoteNode.tsx
web/src/components/nodes/SwimlaneNode.tsx
web/src/components/nodes/FlowBadge.tsx
web/src/components/nodes/SecurityGroupNode.tsx
web/src/components/nodes/CidrNode.tsx
backend/app/services/policy.py
backend/app/services/compliance.py
backend/app/services/capacity.py
backend/app/services/failure_injection.py
backend/app/services/blast_radius.py
backend/app/services/cost_model.py
```

(`DiagramLegend.tsx` e `TitleBlock.tsx` existem; o gap é qualidade de **export** e linguagem visual, não o arquivo vazio.)

---

## Fora de escopo deste inventário

- Marketing, pricing, onboarding comercial.
- Reescrever o motor de IA (OmniRoute) — o gap é **amarração e evidência**, não “mais um agente”.
- Trocar React Flow. O problema não é a lib; é o **skin** e o **pacote de vistas**.

---

*Inventário gerado em 18/08/2026 a partir do código em `system_design/` cruzado com o roadmap de 14/08 e com o teste visual de diagramas profissionais (híbrido, OpenShift, AWS IoT, VPC+CI/CD, pipeline Azure). Revisar quando fechar a fila 1 (board-ready).*
