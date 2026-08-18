# Transformar Archia em Ferramenta de Arquitetura de Software Real

## Visao geral
O documento `fundamentos-arquitetura-software.md` descreve um pipeline de 5 etapas e um sistema de avaliacao por 4 dominios (AN/AD/AA/AI). O Archia hoje tem simulacao realista e analise heuristica basica, mas nao modela estilos arquiteturais, nao calcula coerencia entre dominios, e nao oferece metricas de coesao/acoplamento.

Este plano transforma o Archia em uma ferramenta util para um arquiteto de software real.

---

## Fase 1 — Backend: Schemas + Heurísticas + Agentes

### 1.1 `backend/app/schemas/arch_style.py` (novo)
- `ArchStyle = Literal["monolithic", "layered", "microservices", "event_driven", "hexagonal", "serverless", "soa"]`
- `ArchStyleInfo`: nome, descricao_curta, quando_usar, riscos_tipicos
- `DomainCoherenceScore`: an, ad, aa, ai, geral (float 0-10)
- `CohesionCoupling`: cohesion_score (0-10), coupling_score (0-10), por_dominio (dict)
- `TradeOffEntry`: decisao, alternativa_rejeitada, vantagem, desvantagem, criterio_escolha

### 1.2 `backend/app/schemas/graph.py` — expandir `ProjectNfr`
- arch_style: ArchStyle | None = None
- business_processes: list[str] (AN)
- data_entities: list[str] (AD)
- data_governance: list[str] (AD)

### 1.3 `backend/app/schemas/analysis.py` — expandir `AnalysisResult`
- arch_style, style_confidence, domain_coherence, cohesion_coupling, trade_offs, style_findings

### 1.4 `backend/app/services/architecture_heuristics.py` (novo)
- `classify_architecture_style(nodes, edges, nfr) -> tuple[str, float]`
- `compute_cohesion_coupling(nodes, edges) -> CohesionCoupling`
- `check_domain_coherence(nodes, edges, nfr) -> DomainCoherenceScore`
- `suggest_trade_offs(nodes, edges, nfr) -> list[TradeOffEntry]`

### 1.5 `backend/app/agents/prompts.py` — 3 novos prompts
- STYLE_PROMPT, COHERENCE_PROMPT, TRADEOFFS_PROMPT

### 1.6 `backend/app/agents/runner.py` — estender pipeline
- Adicionar agentes style, coherence, tradeoffs
- `_merge` incorpora resultados

### 1.7 `backend/app/services/knowledge.py` — dados auxiliares
- ARCH_STYLE_KEYWORDS, STYLE_RECOMMENDATIONS

---

## Fase 2 — Frontend: Novos painéis

### 2.1 `web/src/lib/types.ts` — expandir tipos
- Adicionar arch_style, business_processes, data_entities, data_governance

### 2.2 `web/src/components/panels/ArchitectureStylePanel.tsx` (novo)
- Cards visuais para cada estilo
- Recomendacao automatica baseada nos NFRs

### 2.3 `web/src/components/panels/BusinessArchitecturePanel.tsx` (novo)
- Seção AN: processos de negocio (chips)

### 2.4 `web/src/components/panels/DataArchitecturePanel.tsx` (novo)
- Seção AD: entidades de dados (chips), regras de governança

### 2.5 `web/src/components/panels/ArchitecturePanel.tsx` (novo)
- Abas: Negocio (AN) | Dados (AD) | Analise | Trade-offs

### 2.6 `web/src/components/panels/AnalysisPanel.tsx` — atualizar
- Adicionar secoes de estilo, coerencia, coesao, trade-offs

### 2.7 `web/src/components/panels/ContextPanel.tsx` — atualizar
- Botao "Abrir Painel de Arquitetura"

### 2.8 `web/src/lib/graph-store.ts` — atualizar
- Adicionar setArchStyle, setBusinessProcesses, setDataEntities, setDataGovernance

---

## Fase 3 — Templates, ADR e Testes

### 3.1 `web/src/lib/templates.ts` — 5 novos templates
- monolith-simple, layered-traditional, event-driven, hexagonal-ddd, serverless-events

### 3.2 `web/src/components/panels/AdrPanel.tsx` — atualizar
- ADRs gerados a partir de trade-offs
- Edicao manual com status

### 3.3 Testes backend
- test_arch_style_heuristics.py
- test_architecture_pipeline.py
- Atualizar test_heuristic.py, test_nfr_kickoff.py

### 3.4 Testes frontend
- arch-style.test.ts
- ArchitectureStylePanel.test.tsx

---

## DoD (Checklist)

- Schemas backend atualizados
- Heurísticas funcionando
- 3 novos agentes de IA
- ArchitectureStylePanel
- BusinessArchitecturePanel (AN)
- DataArchitecturePanel (AD)
- ArchitecturePanel unificado
- AnalysisPanel atualizado
- ContextPanel atualizado
- 5 novos templates
- ADRPanel atualizado
- Testes passando
- README atualizado
- Push GitHub

---

## Notas

1. Heurísticas vs IA: heurísticas locais são determinísticas; agentes IA dão justificativas textuais
2. Coerência: verifica se processos de negócio (AN) têm suporte em sistemas (AA), entidades de dados (AD) estão nos nós DB
3. PRs separados: [1] Backend, [2] Frontend, [3] Templates+testes