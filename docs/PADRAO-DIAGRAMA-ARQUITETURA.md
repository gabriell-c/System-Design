# Padrão de Diagrama de Arquitetura de Software (Archia)

Guia para produzir diagramas **review-ready**: o que um arquiteto de software espera ver, como ler, e como o Archia avalia (scorecard).

Meta: **scorecard geral ≥ 8.0** = passaria em um design review sério.

---

## 1. Pacote mínimo (não é só um PNG)

Todo desenho review-ready entrega **quatro vistas** + decisões:

| Vista | Domínio | Conteúdo mínimo |
|-------|---------|-----------------|
| Contexto | **AN** | Atores, processos de negócio, objetivo |
| Aplicação | **AA** | Serviços/APIs, contratos, estilo arquitetural |
| Dados | **AD** | Entidades, ownership, stores, governança |
| Runtime | **AI** | Zonas (edge/region/vpc/az/private), sync/async, protocolos |

No Archia, o canvas costuma ser a vista **AI**. As vistas AN/AD/AA vivem no Kickoff/NFR (`business_processes`, `data_entities`, `data_governance`, `arch_style`) e no painel de Arquitetura. O pacote só é completo com as quatro.

---

## 2. Checklist visual obrigatório

- [ ] Fluxos **numerados e contínuos** (sem saltar passos sem motivo documentado)
- [ ] Toda aresta com **`flowKind` + `protocol` + label`**
- [ ] Componentes na **zona correta** (compute sensível em private; auth em security_boundary)
- [ ] **Caminho crítico** marcado (request feliz + pelo menos um caminho de falha)
- [ ] Observabilidade como **destino de telemetria**, não depósito genérico
- [ ] Pelo menos **1 trade-off** e **1 ADR** por decisão estrutural
- [ ] NFRs/SLOs preenchidos (disponibilidade, latência p99, escala)

---

## 3. Scorecard do arquiteto (0–10)

| Eixo | O que mede |
|------|------------|
| **Clareza narrativa** | Sequência legível em &lt;30s (números, labels) |
| **Completude de vistas** | AN / AD / AA / AI presentes e coerentes |
| **Correção de placement** | Zona vs kind/capability (ex.: DB em public = penalidade) |
| **Continuidade de fluxo** | Hops, protocolos, gaps de numeração |
| **Operabilidade** | Observabilidade, failure behavior, ambientes/backup |
| **Decisão explícita** | Trade-offs, ADRs, NFR/SLO |

**Geral** = média dos eixos. **`review_ready`** = geral ≥ 8.0 e nenhum eixo crítico &lt; 5.0.

---

## 4. Como um arquiteto lê o diagrama

1. **Zonas e limites** — onde as coisas vivem (edge vs VPC vs private).
2. **Fluxo 1→N** — história do request (happy path).
3. **Dados** — quem escreve/lê o quê; ownership.
4. **Falha** — o que acontece se um hop quebra (retry/DLQ/fallback).
5. **Trade-offs** — por que essa stack e não a alternativa.
6. **Como testar** — simulação de carga, contract tests, chaos no caminho crítico.

---

## 5. Anti-padrões (o que derruba o score)

- Storage (Dynamo/S3) no *control plane* sem justificativa
- IoT Core “dentro” de Observability se não for telemetria explícita
- Seta DynamoDB → S3 sem hop intermediário (Stream/Lambda/Export)
- Multi-AZ só visual (só um AZ no fluxo numerado)
- Labels genéricos (`INFRA` em Power BI / ML sem distinção de papel)
- Diagrama sem processos de negócio nem entidades de dados

---

## 6. Architecture Package (export)

O export review-ready inclui:

1. Resumo por zona + componentes
2. NFRs / SLOs
3. Vistas AN / AD / AA / AI
4. Scorecard + findings
5. Trade-offs + ADRs
6. Caminho crítico + failure modes
7. Como testar (presets de simulação quando existirem)

Esse é o artefato para PR / review com um arquiteto.

---

## 7. Relação com o produto Archia

- Heurísticas: `architecture_heuristics.build_review_scorecard`
- Painel: Arquitetura → scorecard por eixo
- Kickoff: itens bloqueantes para “review-ready”
- Modos de vista no canvas: Runtime (AI) | Aplicação (AA) | Dados (AD) | Negócio (AN)
- Templates senior-grade já nascem com AN/AD, critical path e failure mode

Ver também: [fundamentos-arquitetura-software.md](../../fundamentos-arquitetura-software.md), [features/arquitetura-real.md](features/arquitetura-real.md).
