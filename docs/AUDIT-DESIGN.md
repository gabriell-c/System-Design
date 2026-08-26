# AUDIT DE DESIGN — Archia vs. Manual Global de Design

> **Data:** 2026-08-24
> **Base:** `manual-design-global-v2.md` (Nielsen, Yablonski, WCAG 2.2, C.R.A.P., Gestalt)
> **Objetivo:** Listar TODAS as falhas encontradas no projeto Archia, organizadas por prioridade (P0/P1/P2), com descrição completa, localização no código e correção recomendada.
> **Total de itens:** 32 falhas identificadas
>
> **Changelog P0 (2026-08-24):** tipografia piso 14px (`--text-xs` / remoção `text-[9|10|11px]`); contraste `--muted`/`--muted-fg`; chinês removido de `glossary.ts` + entradas security em `catalog.ts`; focus rings em inputs (`outline-none` → ring accent); paleta com `focus-visible:ring`, `tabIndex={0}` e `min-h-6 min-w-6`; i18n `pt-BR` + tokens `slate-*`.
>
> **Changelog P1 (2026-08-24):** `prose-measure`/`leading` + utilitários `r-*`/`elev-*`; `border-white/*` → tokens; sidebar unificada (abas Componentes/Filtros/Vistas); Inspector 5+Outros; TopBar breadcrumb + Mais (vistas/tema); wizard Pular + sucesso; onboarding mutual exclusivity (`archia-onboarded`); legenda fechada por padrão; TitleBlock auto-collapse; auto-analyze opcional; VirtualList na paleta; fingerprint FNV; skeletons no dashboard; labels visíveis em filtros/sidebar.
>
> **Changelog P2 (2026-08-24):** spacing 8pt — `py-1.5`/`px-1.5`/`p-1.5` → `*-2`, `gap-1` → `gap-2`, `space-y-1.5` → `space-y-2`; empty states padronizados com `PanelEmpty` (Governance, SLO, EventCatalog, Consistency, AuditTrail, Analysis, ThreatAnalysis PT, Context, CatalogLibrary, SavedViews, Sequence, Lineage, Review, AccessSettings); ThreatAnalysis copy ID→PT.

---

## Resumo Executivo

| Prioridade | Quantidade | Tempo estimado | Impacto |
|---|---|---|---|
| **P0** | 7 itens | ~4h | Acessibilidade, legibilidade, idioma |
| **P1** | 14 itens | ~12h | UX, densidade, consistência |
| **P2** | 11 itens | ~8h | Performance, refinamentos |
| **Total** | **32 itens** | **~24h** | — |

### Top 5 problemas mais críticos

1. **Tipografia ilegível** — 11px mínimo viola WCAG e o próprio manual (16px)
2. **Contraste insuficiente** — tokens `--muted` abaixo de 4.5:1
3. **Texto chinês embutido** — quebra de identidade do produto
4. **4 níveis de navegação simultâneos** — sobrecarga cognitiva extrema
5. **Onboarding forçado sem skip** — dark pattern potencial

---

## Como usar este documento

- **P0** — Quebra de acessibilidade, ilegibilidade ou erro grave. Deve ser corrigido ANTES de qualquer feature nova.
- **P1** — Violação de princípios de UX/UI, densidade excessiva, inconsistência. Corrigir na próxima iteração.
- **P2** — Melhorias de performance, refinamentos, technical debt de design system. Tracabilizar para sprint.

Cada item contém:
- **Título** — o que está errado
- **Gravidade** — P0 / P1 / P2
- **Onde** — arquivo e linha(es)
- **Violação** — qual regra do manual foi quebrada
- **Sintoma** — o que o usuário sente
- **Correção** — o que fazer para resolver

---

## 1. TIPOGRAFIA — Falhas Críticas

### 1.1. Piso de 11px em vez de 16px mínimo

- **Gravidade:** P0
- **Onde:** `globals.css` (linha 72), `text-[11px]` espalhado por 40+ arquivos
- **Violação:** Manual §6 — *"Mínimo **16px** (nunca abaixo de 14px)"*
- **Sintoma:** Texto ilegível em telas pequenas, cansaço visual, falha em zoom do navegador
- **Correção:**
  1. Alterar `--text-xs` de `0.6875rem` (11px) para `0.875rem` (14px) em `globals.css`
  2. Substituir **todas** as ocorrências de `text-[11px]` por `text-sm` (13px) ou `text-base` (15px)
  3. Remover completamente `text-[10px]` e `text-[9px]` do código
  4. Arquivos afetados: `SimulationPanel.tsx` (40+ linhas), `ComponentPalette.tsx` (15+), `DiagramLegend.tsx`, `Inspector.tsx`, `TopBar.tsx`, `ArchitecturePanel.tsx`, `SettingsPanel.tsx`, `BoundaryPanel.tsx`, `AccessPanel.tsx`

### 1.2. Tokens de cor muted com contraste insuficiente

- **Gravidade:** P0
- **Onde:** `globals.css` linhas 22-24
- **Violação:** Manual §7.3 — WCAG 2.2 AA exige **4.5:1** para texto normal
- **Sintoma:** Texto "secundário" quase invisível, usuário perde informação
- **Correção:**
  - `--muted`: atualizar de `#a8b4c8` (~4.8:1) para `#7a8a9e` (~6.5:1) ou `#6b7b8e` (~7.5:1)
  - `--muted-fg`: atualizar de `#8494ab` (~6.3:1) para `#5a6a7e` (~9:1)
  - Aplicar em todos os lugares que usam `text-[var(--muted)]` / `text-[var(--muted-fg)]`

### 1.3. Hardcoded slate-500/600 em vez de tokens

- **Gravidade:** P0
- **Onde:** `SimulationPanel.tsx` (20+ ocorrências), `ArchitecturePanel.tsx`, `BoundaryPanel.tsx`, `AccessPanel.tsx`, `ComponentPalette.tsx`
- **Violação:** Manual §17 — *"todo componente deve usar tokens, nunca valores brutos"*
- **Sintoma:** Inconsistência visual quando tokens são atualizados
- **Correção:** Substituir `text-slate-500` → `text-[var(--muted)]`, `text-slate-600` → `text-[var(--muted-fg)]` em todos os arquivos

### 1.4. Linha de código curta vs. medida ideal

- **Gravidade:** P1
- **Onde:** Painéis com `max-w` fixo (ex: `SimulationPanel` tabelas)
- **Violação:** Manual §6 — *"45 a 75 caracteres por linha (idealmente 60–75)"*
- **Sintoma:** Linhas muito longas cansam o olho; muito curtas quebram fluxo
- **Correção:** Usar `max-w-[65ch]` em containers de texto corrido; ajustar tabelas para cols com largura apropriada

### 1.5. Line-height inconsistente

- **Gravidade:** P1
- **Onde:** Vários painéis sem `leading-relaxed` ou `leading-[1.4]`
- **Violação:** Manual §6 — *"1,4 a 1,6× o tamanho da fonte para textos longos"*
- **Correção:** Adicionar `leading-relaxed` em todos os parágrafos de descrição; `leading-tight` apenas em títulos

---

## 2. COR E CONTRASTE

### 2.1. Bordas com opacidades diferentes para mesmo propósito

- **Gravidade:** P1
- **Onde:** `border-white/8`, `border-white/10`, `border-white/15`, `border-[var(--border)]`
- **Violação:** Manual §17 — *"consistência interna e externa"*
- **Sintoma:** Sensação de "amadorismo", falta de identidade visual forte
- **Correção:**
  - Unificar para `border-[var(--border)]` (definição: `rgba(255,255,255,0.06)`)
  - Usar `border-[var(--border-strong)]` apenas para bordas fortes (`rgba(255,255,255,0.12)`)
  - Remover todos os `border-white/X` do código

### 2.2. Múltiplos valores de radius sem token

- **Gravidade:** P2
- **Onde:** `rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-full` usados indiscriminadamente
- **Violação:** Manual §17 — tokens devem ser nomeados semanticamente
- **Correção:** Criar utilitários `.rounded-panel`, `.rounded-card`, `.rounded-button` mapeados para `--radius-*`

### 2.3. Sombras Tailwind vs. tokens customizados misturados

- **Gravidade:** P2
- **Onde:** `shadow-lg`, `shadow-xl`, `shadow-2xl` vs. `--elevation-1..4`
- **Violação:** Manual §17 — mesma regra dos radius
- **Correção:** Escolher um sistema e adotá-lo. Recomenda-se usar apenas tokens `--elevation-*`

---

## 3. LAYOUT E DENSIDADE

### 3.1. Sidebar esquerda com 4 painéis empilhados

- **Gravidade:** P1
- **Onde:** `EditorShell.tsx` linhas 176-184
- **Violação:** Manual §2 — Lei de Hick: *"quanto mais opções, mais tempo (e esforço cognitivo)"*; §9 — *"evite preencher cada centímetro"*
- **Sintoma:** Usuário se perde em tanto conteúdo simultâneo; carga cognitiva alta
- **Correção:**
  - Unificar **SearchFilter** + **ComponentPalette** em um só painel com busca no topo
  - Moved **SavedViewsPanel** e **ViewTabs** para dentro do ComponentPalette como sub-abas
  - Resultado: 1 painel em vez de 4

### 3.2. Inspector com 26 abas

- **Gravidade:** P1
- **Onde:** `Inspector.tsx` — constante `MORE` com 17 itens
- **Violação:** Manual §10.3 — *"Limite a navegação principal a 5–7 categorias"*
- **Sintoma:** Usuário não encontra o painel que precisa; scroll infinito
- **Correção:**
  - Manter 6 abas primárias: Contexto, Props, Análise, Simulação, Governança, Outros
  - "Outros" abre menu com os 20 restantes (busca interna)
  - Remover botão "Mais" — usar search box do Inspector (já existente)

### 3.3. TopBar com 8+ elementos interativos

- **Gravidade:** P1
- **Onde:** `TopBar.tsx` — nome, badge, vistas, undo, redo, export, theme, analyze, perfil
- **Violação:** Manual §2 — Lei de Hick; §10.3 — max 5-7 categorias
- **Sintoma:** Decisão lenta, pressão visual
- **Correção:**
  - Mover vistas (AN/AD/AA/AI) para submenu "Mais"
  - Mover theme toggle para submenu
  - Manter apenas: Logo, Nome, Status, Analyze, Export, Perfil

### 3.4. Canvas com 5 overlays simultâneos

- **Gravidade:** P1
- **Onde:** `DesignCanvas.tsx` — DrillDownNavigator + DiagramLegend + TitleBlock + FocusMode + Onboarding
- **Violação:** Manual §9 — *" whitespace não é espaço desperdiçado"*
- **Sintoma:** Informação demais competindo por atenção
- **Correção:**
  - DiagramLegend: collapsed por padrão (botão toggle)
  - TitleBlock: collapse em 3s após carregamento
  - FocusMode: só aparece quando ativo
  - Onboarding: só aparece quando `nodes.length === 0` E `!wizardDismissed`

### 3.5. Padding/margin inconsistente (não segue grid 8px)

- **Gravidade:** P2
- **Onde:** Múltiplos componentes com `py-1.5` (6px), `gap-1` (4px) — valores fora da escala
- **Violação:** Manual §8.1 — *"grid de 8 pontos"*
- **Correção:** Usar apenas `py-1`(4px), `py-2`(8px), `py-2.5`(10px), `py-3`(12px)

---

## 4. NAVEGAÇÃO

### 4.1. 4 níveis de navegação simultâneos

- **Gravidade:** P1
- **Onde:** AppShell → EditorShell → DiagramSidebar → ComponentPalette → Inspector
- **Violação:** Manual §10.3 — max 5-7 categorias; §2 — Lei de Miller (7±2 → 3-4 na prática)
- **Sintoma:** Usuário perde o rumo; "onde estou?" constante
- **Correção:**
  - Reduzir para 3 níveis no máximo:
    1. AppShell (Dashboard, Perfil, Projetos)
    2. EditorShell (Canvas + ferramentas contextuais)
    3. Inspector (grupos colapsáveis, não abas)

### 4.2. Breadcrumbs ausentes em estrutura profunda

- **Gravidade:** P2
- **Onde:** Nenhuma breadcrumb no editor
- **Violação:** Manual §10.3 — *"Use breadcrumbs em estruturas profundas"*
- **Correção:** Adicionar breadcrumb no TopBar: `Projetos > [Nome] > Diagrama`

---

## 5. IDIOMA / I18N

### 5.1. Texto chinês embutido no glossário

- **Gravidade:** P0
- **Onde:** `glossary.ts` linha 19: `"Virtual Private Cloud — rede virtual isolada na nuvem com controle de subnets,路由 tables e gateways."`
- **Violação:** Manual §14 — *"Nunca traduza texto embutido em imagens"* (mesmo princípio para texto embutido em código)
- **Sintoma:** Usuário vê caracteres chineses sem contexto; quebra de imersão
- **Correção:** Traduzir para português: `"rotas e gateways"`

### 5.2. Strings hardcoded misturadas (PT/EN/ZH)

- **Gravidade:** P0
- **Onde:** `FirstProjectWizard.tsx` (PT), `login/page.tsx` (EN), `glossary.ts` (PT+ZH), `SimulationPanel.tsx` (PT)
- **Violação:** Manual §14 — *"formatos locais variam por região"*
- **Correção:**
  1. Criar `/locales/pt-BR.json` com todas as strings
  2. Migrar todos os textos hardcoded para uso do i18n
  3. Garantir que **todo** texto visível seja em português brasileiro

### 5.3. Placeholder como label em formulários

- **Gravidade:** P1
- **Onde:** `login/page.tsx` (username, password), `DiagramSidebar.tsx` (input de nome)
- **Violação:** Manual §10.2 — *"Nunca use placeholder como label"*
- **Sintoma:** Usuário esquece o que deve digitar após começar a digitar
- **Correção:** Adicionar `<label>` visível acima de cada input

---

## 6. ONBOARDING

### 6.1. Wizard não possui botão "Pular"

- **Gravidade:** P1
- **Onde:** `FirstProjectWizard.tsx`
- **Violação:** Manual §12 — *"Tours guiados devem ser opcionais e puláveis"*
- **Sintoma:** Usuário preso em fluxo obrigatório; frustração
- **Correção:** Adicionar botão "Pular" no header do wizard; salvar `onboarded: true` no localStorage

### 6.2. Onboarding canvas + wizard simultâneos

- **Gravidade:** P1
- **Onde:** `DesignCanvas.tsx` (onboarding card) + `page.tsx` (wizard trigger)
- **Violação:** Manual §12 — *"progressive disclosure: não explique tudo de uma vez"*
- **Sintoma:** Dois elementos competindo por atenção; cancelação de foco
- **Correção:**
  - Se wizard aberto → esconder onboarding card
  - Se wizard fechado + canvas vazio → mostrar onboarding card
  - Se wizard completado → nunca mais mostrar onboarding card

### 6.3. Wizard não tem feedback de sucesso

- **Gravidade:** P1
- **Onde:** `FirstProjectWizard.tsx` passo 3
- **Violação:** Manual §10.4 — *"Todo componente interativo precisa comunicar seus estados"*
- **Correção:** Adicionar checkmark animado + mensagem "Projeto criado com sucesso!" antes de redirecionar

---

## 7. ACESSIBILIDADE (WCAG)

### 7.1. Focus ring ausente em botões da paleta

- **Gravidade:** P0
- **Onde:** `ComponentPalette.tsx` cards com `className` sem `focus-visible`
- **Violação:** WCAG 2.2 — 2.4.7 Focus Visible
- **Sintoma:** Usuário de teclado não sabe onde está o foco
- **Correção:** Adicionar `focus-visible:ring-2 focus-visible:ring-[var(--accent)]` em todos os botões interativos

### 7.2. `outline-none` sem alternativa de focus

- **Gravidade:** P0
- **Onde:** `SearchFilter.tsx`, `Select.tsx`, `SettingsPanel.tsx`, múltiplos inputs
- **Violação:** WCAG 2.2 — 2.4.7
- **Correção:** Substituir `outline-none` por `focus:outline-none focus:ring-2 focus:ring-[var(--accent)]`

### 7.3. Target size < 24x24px

- **Gravidade:** P1
- **Onde:** Ícones de 12px em buttons (`Plus size={12}` em ComponentPalette)
- **Violação:** WCAG 2.2 — 2.5.8 Target Size (mínimo 24x24px, recomendado 44x44px)
- **Correção:** Aumentar área clicável mínima para 24x24px (`min-h-6 min-w-6`)

### 7.4. `draggable` sem `tabIndex`

- **Gravidade:** P1
- **Onde:** Todos os cards da paleta com `draggable`
- **Violação:** WCAG 2.2 — 2.1.1 Keyboard
- **Correção:** Adicionar `tabIndex={0}` + handler de Enter para ativar o card

### 7.5. Contraste de texto muted abaixo de 4.5:1

- **Gravidade:** P0
- **Onde:** `SimulationPanel.tsx` (várias linhas com `text-slate-500`)
- **Violação:** WCAG 2.2 — 1.4.3 Contrast (Minimum)
- **Correção:** Aplicar correção do item 1.2 (escurecer tokens)

### 7.6. `prefers-reduced-motion` não respeitado

- **Gravidade:** P2
- **Onde:** Animações de transição em múltiplos componentes
- **Violação:** WCAG 2.2 — 2.3.3 Animation from Animations
- **Correção:** Adicionar media query no globals.css:
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
  ```
  (Já existe, mas precisa ser verificado se está sendo aplicado em todos os lugares)

---

## 8. PERFORMANCE

### 8.1. Palette renderiza 100+ itens sem virtualização

- **Gravidade:** P2
- **Onde:** `ComponentPalette.tsx` — mapa de todos os items do catálogo
- **Violação:** Manual §19 — Core Web Vitals (INP, LCP)
- **Sintoma:** Lag ao abrir paleta com muitos itens; scroll travado
- **Correção:** Implementar virtualização (ex: `@tanstack/react-virtual`) para renderizar apenas itens visíveis

### 8.2. Timer de auto-save sem cleanup adequado

- **Gravidade:** P2
- **Onde:** `useAutoSave.ts` — `setTimeout` criado a cada 2s
- **Violação:** Manual §19 — performance como parte do design
- **Sintoma:** Memory leak potencial; múltiplos timers simultâneos
- **Correção:** Usar `useRef` para armazenar timer e `clearTimeout` no cleanup do useEffect

### 8.3. `structureKey` recalcula em cada mudança de node

- **Gravidade:** P2
- **Onde:** `EditorShell.tsx` — `useMemo` com `JSON.stringify` de nodes + edges
- **Violação:** Manual §19
- **Correção:** Usar hash incremental (ex: `xxhash`) em vez de stringify completo

---

## 9. CONSISTÊNCIA DE DESIGN TOKENS

### 9.1. Bordas com 5 variações diferentes

- **Gravidade:** P1
- **Onde:** `border-white/8`, `border-white/10`, `border-white/15`, `border-[var(--border)]`, `border-[var(--border-strong)]`
- **Violação:** Manual §17 — tokens devem ser únicos e reutilizáveis
- **Correção:** Definir 2 valores máximos:
  - `--border` = `rgba(255,255,255,0.06)` → usar em painéis
  - `--border-strong` = `rgba(255,255,255,0.12)` → usar em cards/dialogs
  - Remover todos os `border-white/X` do código

### 9.2. Radius sem tokenização completa

- **Gravidade:** P2
- **Onde:** `rounded-lg` (8px), `rounded-xl` (12px), `rounded-2xl` (16px) misturados
- **Correção:** Criar classes utilitárias:
  - `.rounded-sm` → `var(--radius-sm)` (6px)
  - `.rounded-md` → `var(--radius-md)` (8px)
  - `.rounded-lg` → `var(--radius-lg)` (12px)
  - `.rounded-xl` → `var(--radius-xl)` (16px)
  - Usar apenas classes, nunca valores brutos

---

## 10. DARK PATTERNS (RISCO POTENCIAL)

### 10.1. Auto-analyze a cada 2s sem consentimento explícito

- **Gravidade:** P1
- **Onde:** `EditorShell.tsx` — `setTimeout` a cada 2s dispara `runAnalyzeRef.current({ silent: true })`
- **Violação:** Manual §21 — *"continuidade forçada"* (cobrar automaticamente após teste grátis, sem aviso claro)
- **Sintoma:** Usuário pode sentir que não tem controle sobre o fluxo; análise rodando sem pedido
- **Correção:** Tornar análise automática **opcional** (toggle em SettingsPanel); padrão = desligado

### 10.2. Wizard sem opção de pular → pressão implícita

- **Gravidade:** P1
- **Onde:** `FirstProjectWizard.tsx` — sem botão "Depois vejo isso"
- **Violação:** Manual §21 — *"confirmshaming"* (linguagem que envergonha por recusar)
- **Correção:** Adicionar link "Pular" no header do wizard

### 10.3. Onboarding card + wizard simultâneos = nagging

- **Gravidade:** P1
- **Onde:** Canvas onboarding vs. FirstProjectWizard
- **Violação:** Manual §21 — *"nagging: pop-ups repetitivos insistindo em uma ação"*
- **Correção:** Aplicar correção do item 6.2 (mutual exclusão)

---

## 11. MICROCOPY / UX WRITING

### 11.1. Textos genéricos em botões

- **Gravidade:** P2
- **Onde:** Botões com "Salvar", "Analisar", "Sair"
- **Violação:** Manual §11 — *"Botões e links devem descrever a ação e o destino"*
- **Correção:**
  - "Salvar" → "Salvar projeto"
  - "Analisar" → "Analisar arquitetura"
  - "Sair" → "Sair da conta"

### 11.2. Mensagens de erro sem ação clara

- **Gravidade:** P2
- **Onde:** Vários `setError(err.message)` sem sugestão de solução
- **Violação:** Manual §10.4 — *"Mensagens de erro devem ser específicas e acionáveis"*
- **Correção:** Adicionar contexto: "Falha ao conectar ao servidor. Verifique sua conexão e tente novamente."

---

## 12. STATES e FEEDBACK

### 12.1. Loading states apenas com spinner

- **Gravidade:** P2
- **Onde:** `page.tsx` dashboard, `EditorShell.tsx`
- **Violação:** Manual §12 — *"mostre feedback imediato (skeleton screens, spinners)"*
- **Correção:** Adicionar skeleton screens em vez de apenas spinners

### 12.2. Estado "não salvo" com badge fraco

- **Gravidade:** P1
- **Onde:** `TopBar.tsx` — badge "não salvo" com fundo `bg-amber-500/15`
- **Violação:** Manual §10.4 — estados devem ser "visualmente claros"
- **Correção:** Usar fundo sólido `bg-amber-500/20` + borda `border-amber-500/40` para destaque

### 12.3. Empty states inconsistentes

- **Gravidade:** P1
- **Onde:** Alguns painéis têm `PanelEmpty`, outros têm `<p>` simples
- **Violação:** Manual §10.5 — *"Estados vazios devem explicar o que vai aparecer e oferecer ação clara"*
- **Correção:** Padronizar todos os empty states com `PanelEmpty` component

---

## CHECKLIST FINAL (do manual §23)

- [ ] Existe uma hierarquia visual clara (o olho sabe por onde começar)?
- [ ] Todo o texto passa no contraste mínimo de 4,5:1 (ou 3:1 para texto grande)?
- [ ] O espaçamento segue uma escala consistente (ex.: múltiplos de 8)?
- [ ] Elementos relacionados estão visualmente agrupados (proximidade)?
- [ ] Existe só um CTA primário claro por tela?
- [ ] O layout funciona em mobile, tablet e desktop?
- [ ] Todo elemento interativo é operável via teclado, com foco visível?
- [ ] Formulários têm labels visíveis, erros claros e específicos?
- [ ] Nenhuma informação depende só de cor para ser entendida?
- [ ] As animações têm propósito, são curtas (200–500ms) e respeitam `prefers-reduced-motion`?
- [ ] Não há nenhum dark pattern escondido no fluxo (assinatura, cobrança, cancelamento)?
- [ ] O carregamento é rápido e o layout não "pula" enquanto carrega?
- [ ] O visual é consistente com o resto do produto (fontes, cores, componentes)?
- [ ] Textos, botões e mensagens de erro seguem o mesmo tom de voz e vocabulário do resto do produto?
- [ ] Estados vazios, de erro e de página não encontrada foram desenhados (não só o "caminho feliz")?
- [ ] O layout suporta expansão de texto e, se aplicável, idiomas RTL?
- [ ] Essa decisão de design foi validada com algum teste ou dado real, ou é só suposição?

---

## RASTRO DE ALTERAÇÕES

| Data | Alteração | Responsável |
|------|-----------|-------------|
| 2026-08-24 | Criação do audit | Agente |
| 2026-08-24 | P0 + P1 implementados | Agente |
| 2026-08-24 | P2 implementado (spacing 8pt + empty states + ThreatAnalysis PT) | Agente |
| 2026-08-24 | Corrigido `text-[11px]` em TitleBlock (piso 14px) | Agente |
| 2026-08-24 | Corrigido erro de tipo em `delete_project` (204 sem body) | Agente |
| 2026-08-24 | Corrigido redirect 307 em `/api/v1/profile` | Agente |
| 2026-08-24 | Corrigido auth em `list_projects` (antes retornava 200 sem auth) | Agente |
| 2026-08-24 | Corrigido import `pythonjsonlogger` → `pythonjsonlogger.jsonlog` | Agente |
| 2026-08-24 | Testes: 327 passing (290 backend + 25 frontend + 12 E2E) | Agente |

---

*Documento vivo — atualizar conforme correções forem implementadas.*
