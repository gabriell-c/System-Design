# Archia — Design System

> Documento canônico de identidade visual, tipografia, cores, espaçamento, componentes, acessibilidade e tokens.  
> Direção: **acessível, balanceado, neutro e profissional** (referência Figma / Notion).  
> Stack: Next.js 16 · Tailwind CSS v4 · React 19.

---

## Índice

1. [Visão geral e princípios](#1-visão-geral-e-princípios)
2. [Tipografia](#2-tipografia)
3. [Paleta de cores](#3-paleta-de-cores)
4. [Espaçamento e forma](#4-espaçamento-e-forma)
5. [Hierarquia visual](#5-hierarquia-visual)
6. [Componentes](#6-componentes)
7. [Psicologia das cores](#7-psicologia-das-cores)
8. [Acessibilidade](#8-acessibilidade)
9. [Arquitetura de tokens (DTCG)](#9-arquitetura-de-tokens-dtcg)
10. [Motion e feedback](#10-motion-e-feedback)
11. [Layout e shell da aplicação](#11-layout-e-shell-da-aplicação)
12. [Canvas e diagramas](#12-canvas-e-diagramas)
13. [Implementação no código](#13-implementação-no-código)
14. [Checklist de conformidade](#14-checklist-de-conformidade)

---

## 1. Visão geral e princípios

### 1.1 Produto

**Archia** é um editor visual de system design: projetos, diagramas (React Flow), análise, governança e colaboração. Sessões longas são o caso de uso principal — o design deve reduzir fadiga ocular e ruído visual.

### 1.2 Público-alvo

| Persona | Necessidade visual |
|---------|-------------------|
| Arquiteto de software | Densidade controlada, hierarquia clara, canvas legível |
| Engenheiro | Mono para IDs/código, contraste estável, teclado |
| Tech lead / reviewer | Badges semânticos, estados de revisão óbvios |
| Stakeholder | Light mode limpo, tipografia legível, pouco jargão visual |

### 1.3 Princípios (não negociáveis)

1. **Acessibilidade first** — WCAG 2.2 AA como piso; contraste e foco sempre válidos.
2. **Clareza sobre ornamentação** — zero decoração que não comunique estado ou hierarquia.
3. **Foco prolongado** — fundos off-black / off-white; nunca `#000` + `#fff` em texto de corpo.
4. **Minimalismo intencional** — um accent saturado; resto neutro frio.
5. **Tokens, não hardcodes** — cores e espaçamentos via CSS variables / semantic tokens.
6. **Dark-first, light-paritário** — dark é default de produto; light tem a mesma qualidade, não “invertido”.
7. **Progressive disclosure** — dashboard e painéis mostram o próximo passo, não tudo de uma vez.

### 1.4 Referências de mercado

| Produto | O que emprestamos |
|---------|-------------------|
| Figma | Neutros frios, UI densa porém calma, accent controlado |
| Notion | Cards por elevação + whitespace, tipografia sóbria |
| Linear | Ritmo vertical apertado, sidebar limpa (sem copiar purple) |
| Stripe | Semântica de status restrita; um “north star” visual por tela |

---

## 2. Tipografia

### 2.1 Famílias

| Papel | Fonte | Variável CSS | Uso |
|-------|-------|--------------|-----|
| Sans (UI) | **Inter** (variable 100–900) | `--font-archia-sans` | Interface, labels, títulos, corpo |
| Mono | **JetBrains Mono** | `--font-archia-mono` | IDs, JSON, logs, código, handles técnicos |

**Por que Inter (não Geist):** Inter foi desenhada para UI densa em tela; ótica excelente em 11–15px; neutra e universal (Figma/Notion-like). Geist permanece ótimo para “dev brand”, mas Inter alinha melhor ao eixo acessível/profissional escolhido.

**Fallback stack:**

```css
font-family: var(--font-archia-sans), Inter, -apple-system, "Segoe UI", Roboto, sans-serif;
font-family: var(--font-archia-mono), "JetBrains Mono", ui-monospace, Consolas, monospace;
```

### 2.2 Escala tipográfica (razão 1.125 — Major Second)

| Token | Size | Line-height | Uso típico |
|-------|------|-------------|------------|
| `--text-xs` | 11px (0.6875rem) | 1.4 | Captions, badges, meta |
| `--text-sm` | 13px (0.8125rem) | 1.4 | Labels, botões ghost, nav secundária |
| `--text-base` | 15px (0.9375rem) | 1.5 | Corpo padrão da UI |
| `--text-lg` | 17px (1.0625rem) | 1.5 | Subtítulos, nomes de projeto |
| `--text-xl` | 20px (1.25rem) | 1.35 | Títulos de seção |
| `--text-2xl` | 24px (1.5rem) | 1.3 | Título de página |
| `--text-3xl` | 30px (1.875rem) | 1.25 | Hero / empty states (raro) |

**Regra:** no máximo **4 tamanhos distintos** visíveis na mesma viewport (ex.: page title + section + body + caption).

**Floor de legibilidade (editor):** nunca usar `text-[9px]` ou `text-[10px]` em labels/corpo. Mínimo **11px** (`--text-xs`). Badges podem usar a classe `.panel-badge` (também 11px). Texto secundário usa `--muted` (`#a8b4c8`), não `slate-600` com baixa opacidade.

**Inspetor (painel direito):** abas organizadas em 4 grupos colapsáveis (Design · Análise · Governança · Extra) com busca no topo e tooltips curtos — evita a tab bar infinita de 26 itens.

### 2.3 Pesos

| Peso | Token | Uso |
|------|-------|-----|
| 400 | `--font-regular` | Corpo, descrições |
| 500 | `--font-medium` | Labels, nav items |
| 600 | `--font-semibold` | Botões, títulos de card |
| 700 | `--font-bold` | Hero métricas, alertas críticos |

**Dark mode:** preferir 400–500 no corpo (peso “mais leve” opticamente); evitar 700 em blocos longos.

### 2.4 Letter-spacing e case

- Títulos: `tracking-tight` (−0.01em a −0.02em).
- Labels uppercase (seções da sidebar): `text-[11px] font-semibold uppercase tracking-wider` + cor muted.
- Nunca usar ALL CAPS em textos longos.

### 2.5 Antialiasing

```css
body {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}
```

---

## 3. Paleta de cores

### 3.1 Modelo

- **Um accent saturado:** Indigo `#6366f1` (dark) / `#4f46e5` (light).
- **Neutros frios (slate-indigo):** bases off-black / off-white.
- **Semântica:** success / warning / error / info — no dark, ligeiramente dessaturados vs light.

### 3.2 Dark mode (`archia-dark` — default)

| Token semântico | Hex / valor | Papel |
|-----------------|-------------|--------|
| `--background` | `#060913` | Fundo da app (não #000) |
| `--surface-0` | `#060913` | Alias base |
| `--surface-1` | `#0c111c` | Sidebar, painéis |
| `--surface-2` | `#111827` | Cards, inputs |
| `--surface-3` | `#1a1f2e` | Elevated / hover panels |
| `--foreground` | `#f0f4fc` | Texto primário (~90% branco) |
| `--muted` | `#94a3b8` | Texto secundário |
| `--muted-fg` | `#64748b` | Texto terciário / placeholders |
| `--border` | `rgba(255,255,255,0.06)` | Bordas padrão |
| `--border-strong` | `rgba(255,255,255,0.12)` | Separadores fortes |
| `--accent` | `#6366f1` | Primário (ações, links ativos) |
| `--accent-hover` | `#4f46e5` | Hover do accent |
| `--accent-fg` | `#eef2ff` | Texto sobre accent |
| `--accent-muted` | `rgba(99,102,241,0.15)` | Fundo de item ativo |
| `--ring` | `rgba(99,102,241,0.45)` | Focus ring |
| `--success` | `#10b981` | Sucesso |
| `--warning` | `#f59e0b` | Aviso |
| `--error` | `#ef4444` | Erro / perigo |
| `--info` | `#3b82f6` | Informativo |
| `--canvas-bg` | `#060913` | Fundo do React Flow |
| `--sidebar-bg` | `#0c111c` | Sidebar global |
| `--shadow` | `0 4px 24px rgba(0,0,0,0.45)` | Sombra base |

**Aliases de compatibilidade (legado):** `--card-bg` → `--surface-2`; `--card-border` → `--border`; `--card-hover` → `rgba(255,255,255,0.04)`.

### 3.3 Light mode (`archia-light`)

| Token | Valor |
|-------|--------|
| `--background` | `#ffffff` |
| `--surface-1` | `#f8fafc` |
| `--surface-2` | `#ffffff` |
| `--surface-3` | `#f1f5f9` |
| `--foreground` | `#0f172a` |
| `--muted` | `#475569` |
| `--muted-fg` | `#94a3b8` |
| `--border` | `rgba(15,23,42,0.08)` |
| `--border-strong` | `rgba(15,23,42,0.14)` |
| `--accent` | `#4f46e5` |
| `--accent-hover` | `#4338ca` |
| `--accent-fg` | `#eef2ff` |
| `--accent-muted` | `rgba(79,70,229,0.10)` |
| `--ring` | `rgba(79,70,229,0.40)` |
| `--success` | `#059669` |
| `--warning` | `#d97706` |
| `--error` | `#dc2626` |
| `--info` | `#2563eb` |
| `--canvas-bg` | `#f1f5f9` |
| `--sidebar-bg` | `#f8fafc` |
| `--shadow` | `0 4px 24px rgba(15,23,42,0.08)` |

### 3.4 Escala primitiva Indigo (referência)

| Step | Hex |
|------|-----|
| 50 | `#eef2ff` |
| 100 | `#e0e7ff` |
| 200 | `#c7d2fe` |
| 300 | `#a5b4fc` |
| 400 | `#818cf8` |
| **500** | **`#6366f1`** (accent dark) |
| **600** | **`#4f46e5`** (accent light / hover dark) |
| 700 | `#4338ca` |
| 800 | `#3730a3` |
| 900 | `#312e81` |

### 3.5 Uso proibido

- Texto `#ffffff` em fundo `#000000`.
- Accent cyan legado (`#22d3ee`) em novos componentes (migrar para indigo).
- Hardcode `bg-[#0d1219]` / `bg-[#070b10]` em código novo — usar `bg-[var(--surface-*)]` ou classes utilitárias do tema.
- Mais de **uma** cor saturada de marca na mesma tela (exceto semântica success/warn/error).

---

## 4. Espaçamento e forma

### 4.1 Grid base: 4px

| Token | px | rem (16px root) |
|-------|----|-----------------|
| `--space-1` | 4 | 0.25 |
| `--space-2` | 8 | 0.5 |
| `--space-3` | 12 | 0.75 |
| `--space-4` | 16 | 1 |
| `--space-5` | 20 | 1.25 |
| `--space-6` | 24 | 1.5 |
| `--space-8` | 32 | 2 |
| `--space-10` | 40 | 2.5 |
| `--space-12` | 48 | 3 |
| `--space-16` | 64 | 4 |
| `--space-20` | 80 | 5 |
| `--space-24` | 96 | 6 |
| `--space-32` | 128 | 8 |

### 4.2 Aplicação semântica

| Contexto | Token |
|----------|--------|
| Padding interno de botão | `--space-2` × `--space-4` |
| Padding de card | `--space-4` a `--space-6` |
| Gap entre cards no grid | `--space-4` |
| Gap entre seções | `--space-6` a `--space-8` |
| Padding de página (dashboard) | `--space-6` horizontal |

### 4.3 Border radius

| Token | Valor | Uso |
|-------|--------|-----|
| `--radius-sm` | 6px | Chips, inputs densos |
| `--radius-md` | 8px | Botões, inputs padrão |
| `--radius-lg` | 12px | Cards |
| `--radius-xl` | 16px | Modais, sheets |
| `--radius-pill` | 9999px | Badges, toggles |

### 4.4 Ícones

- Biblioteca: **lucide-react**.
- Tamanhos: 14px (inline), 16px (nav), 20px (empty state).
- Stroke: 1.5–2; alinhar à caixa tipográfica com `shrink-0`.

---

## 5. Hierarquia visual

### 5.1 Z-index

| Layer | Token | Valor | Uso |
|-------|-------|-------|-----|
| Base | `--z-base` | 0 | Conteúdo |
| Sticky | `--z-sticky` | 20 | Headers de tabela |
| Sidebar | `--z-sidebar` | 50 | App sidebar |
| Header | `--z-header` | 60 | Topbars de página |
| Dropdown | `--z-dropdown` | 65 | Menus |
| Modal | `--z-modal` | 70 | Dialogs |
| Toast | `--z-toast` | 80 | Notificações |
| Overlay | `--z-overlay` | 90 | Fullscreen / presentation |
| Max | `--z-max` | 100 | Skip link / critical |

### 5.2 Elevação (shadows)

| Nível | Token | CSS sugerido |
|-------|-------|--------------|
| 0 | flat | sem sombra; só border |
| 1 | `--elevation-1` | `0 1px 2px rgba(0,0,0,0.04)` |
| 2 | `--elevation-2` | `0 4px 12px rgba(0,0,0,0.08)` / dark `0.35` |
| 3 | `--elevation-3` | `0 8px 24px rgba(0,0,0,0.12)` / dark `0.45` |
| 4 | `--elevation-4` | `0 16px 48px rgba(0,0,0,0.16)` / dark `0.55` |

No dark, preferir **mudança de surface** (surface-1 → surface-3) em vez de sombra forte.

### 5.3 Hierarquia tipográfica em telas densas

1. **Hero** (métrica ou título de página) — maior peso/tamanho, top-left.
2. **Seção** — `text-lg` + semibold.
3. **Card title** — `text-base` + semibold.
4. **Corpo / meta** — `text-sm` / `text-xs` muted.

**Gestalt:** agrupar por container compartilhado; separar categorias com gap ≥ `--space-6` ou divider.

### 5.4 Contraste mínimo

| Elemento | Razão mínima |
|----------|--------------|
| Texto normal | **4.5:1** (WCAG AA) |
| Texto grande (≥18px / 14px bold) | **3:1** |
| UI / ícones / focus | **3:1** |

---

## 6. Componentes

### 6.1 Botões — 6 estados

| Estado | Comportamento |
|--------|----------------|
| default | Fundo accent / ghost border |
| hover | `--accent-hover` ou surface hover |
| active | Press: scale 0.98 ou darken 4% |
| focus | Ring `--ring` 2px offset 2px |
| disabled | opacity 0.45; `cursor-not-allowed` |
| loading | Spinner 14px; texto “Carregando…” ou aria-busy |

**Variantes:**

- **Primary** — accent sólido; texto `--accent-fg`.
- **Secondary / Ghost** — transparente + border; texto muted → foreground no hover.
- **Danger** — fundo `--error` / texto branco; obrigatório para exclusões.
- **Link** — texto accent; underline no hover.

Classes canônicas: `.btn-primary`, `.btn-ghost`, `.btn-danger`.

### 6.2 Inputs

- Fundo: `--surface-2`.
- Borda: `--border`; focus: accent + ring.
- Padding: `0.5rem 0.75rem`; radius `--radius-md`.
- Erro: border `--error` + mensagem `text-xs` abaixo (nunca só cor).
- Placeholder: `--muted-fg`.

### 6.3 Cards

- Fundo `--surface-2`; border `--border`; radius `--radius-lg`.
- Hover (clicável): border accent/30 + leve elevação.
- Padding `--space-4`–`--space-5`.
- Evitar cards com 5+ ações no footer — progressive disclosure.

### 6.4 Badges

| Variant | Fundo | Texto |
|---------|-------|-------|
| neutral | surface-3 | muted |
| info | info/15 | info |
| success | success/15 | success |
| warning | warning/15 | warning |
| error | error/15 | error |

Pill (`--radius-pill`); `text-xs` medium.

### 6.5 Modais / dialogs

- Overlay: `rgba(0,0,0,0.65)` + `backdrop-blur-sm`.
- Painel: surface-2, radius `--radius-xl`, max-width conforme tipo (sm 24rem / md 32rem / lg 42rem).
- **Focus trap** + Escape fecha; botão Cancelar sempre disponível.
- Título `text-lg` semibold; corpo `text-sm` muted.

### 6.6 Toasts / notices

- Fixed bottom-right (ou top-center em mobile); z `--z-toast`.
- Auto-dismiss 4–6s (erros: persistentes até dismiss).
- Ícone + texto; ação opcional (“Desfazer”).

### 6.7 Sidebar (app)

- Largura expandida: **256px** (`w-64`); colapsada: `0` + botão de toggle.
- Persistência: `localStorage` `archia-sidebar-collapsed`.
- Seções: Geral / Projetos / Ferramentas.
- Item ativo: `--accent-muted` + texto accent.

### 6.8 Tabelas (quando existirem)

- Header sticky surface-3; rows hover +2–4% lightness.
- Truncate com ellipsis; nunca overflow horizontal sem scroll explícito.

---

## 7. Psicologia das cores

### 7.1 Por que Indigo (não Cyan)

| Aspecto | Cyan legado | Indigo (novo) |
|---------|-------------|----------------|
| Associação | “Neon tech”, terminal | Confiança, criatividade, produto SaaS maduro |
| Sessões longas | Alto brilho pode cansar | Menos “brilho” em fundos escuros |
| Light mode | Precisa escurecer muito | Funciona bem em `#4f46e5` |
| Diferenciação | Genérico em dashboards dark | Alinha Figma/Notion (roxo-azul calmo) |

### 7.2 Neutros frios

Reduzem saturação emocional do chrome da UI → o **conteúdo do canvas** e os **status** ganham atenção. Evita competição com diagramas coloridos de arquitetura.

### 7.3 Semântica

- **Verde:** confirmado, salvo, saudável — nunca “só decorativo”.
- **Âmbar:** atenção, não bloqueante.
- **Vermelho:** destrutivo ou falha — sempre com label/ícone.
- **Azul info:** neutro-informativo (não competir com accent indigo).

### 7.4 Densidade e “espaço negativo”

Espaço vazio intencional = respiração. Dashboards não devem “encher” com gráficos. Meta: **5–9 elementos** de decisão visíveis por vista principal.

---

## 8. Acessibilidade

### 8.1 Baseline

- **WCAG 2.2 nível AA**.
- Touch / click targets ≥ **24×24 CSS px** (ideal 32×32 em mobile).
- Focus never obscured (headers sticky não cobrem o foco).
- Alternativa a drag-and-drop no canvas (teclado / menus).

### 8.2 Dark mode específico

- Sem texto branco puro em preto puro (halation).
- Preferir APCA para afinar contraste visual; manter WCAG para compliance.
- Testar em OLED e LCD reais.
- Cor + ícone/padrão juntos (daltonismo).

### 8.3 Teclado e leitores

- Skip link “Pular para conteúdo principal”.
- `aria-label` em ícones-only.
- Dialogs: `role="dialog"` / `alertdialog`, `aria-modal`.
- Switches: `role="switch"` + `aria-checked`.

### 8.4 Preferências do sistema

```css
@media (prefers-reduced-motion: reduce) { /* desligar animações */ }
@media (prefers-contrast: high) { /* outlines mais grossos */ }
```

### 8.5 Temas

- Classes: `archia-dark` | `archia-light` no `<html>`.
- Persistência: `localStorage` `archia-theme`.
- First visit: `prefers-color-scheme`.

---

## 9. Arquitetura de tokens (DTCG)

### 9.1 Três camadas

```
Primitive  →  Semantic  →  Component
(indigo-500)  (accent)     (btn-primary-bg)
```

### 9.2 Primitive (exemplos)

```json
{
  "color": {
    "indigo": { "500": { "$value": "#6366f1" }, "600": { "$value": "#4f46e5" } },
    "neutral": {
      "dark-bg": { "$value": "#060913" },
      "light-bg": { "$value": "#ffffff" }
    }
  },
  "space": { "4": { "$value": "16px" } },
  "radius": { "md": { "$value": "8px" } }
}
```

### 9.3 Semantic

```json
{
  "color": {
    "background": { "$value": "{color.neutral.dark-bg}" },
    "action.primary": { "$value": "{color.indigo.500}" },
    "text.primary": { "$value": "#f0f4fc" }
  }
}
```

### 9.4 Component

```json
{
  "button": {
    "primary": {
      "bg": { "$value": "{color.action.primary}" },
      "fg": { "$value": "#eef2ff" },
      "radius": { "$value": "{radius.md}" }
    }
  }
}
```

### 9.5 Mapeamento no Archia (hoje)

| Camada | Onde vive |
|--------|-----------|
| Primitive + Semantic | `web/src/app/globals.css` (`:root` / `.archia-light`) |
| Component classes | `.btn-primary`, `.btn-ghost`, `.btn-danger`, `.badge`, `.card` |
| Runtime theme | `web/src/lib/theme-store.ts` |

### 9.6 Tipos de token obrigatórios

1. Cor (neutros, brand, semântica) × tema  
2. Espaçamento  
3. Tipografia (size, weight, line-height)  
4. Radius  
5. Elevation / shadow  
6. Motion (duration, easing)  
7. Z-index  
8. Breakpoints (sm 640 / md 768 / lg 1024 / xl 1280)

---

## 10. Motion e feedback

| Interação | Duração | Easing |
|-----------|---------|--------|
| Hover / press | 100–150ms | ease-out |
| Sidebar collapse | 200ms | ease |
| Modal open | 200–300ms | cubic-bezier(0.2, 0.8, 0.2, 1) |
| Toast in/out | 200ms | ease |

**Regras:**

- Animar só `opacity` e `transform` (GPU).
- Nunca > 600ms.
- Respeitar `prefers-reduced-motion`.
- Theme switch: 200ms em background/color/border.

---

## 11. Layout e shell da aplicação

```
┌──────────┬─────────────────────────────┐
│ Sidebar  │  Topbar da página (opcional)│
│ 256px    ├─────────────────────────────┤
│ global   │  Main content (flex-1)      │
│          │  100% altura restante       │
└──────────┴─────────────────────────────┘
```

- Shell: `AppShell` + `SidebarNav` no root layout.
- Páginas **não** duplicam sidebar.
- Editor de projeto: conteúdo full-height; diagram sidebar colapsável.
- Dashboard: stats → filtros → grid; empty states com CTA único.

---

## 12. Canvas e diagramas

- Fundo: `--canvas-bg`.
- Nós: surface elevada + border; labels `text-sm`.
- Seleção: ring accent (não só borda cyan legada).
- Presentation mode: classe `archia-presentation-light` para projeção.
- Minimap / controls: herdar surface-2 no light; contraste AA.

---

## 13. Implementação no código

### 13.1 Arquivos canônicos

| Arquivo | Responsabilidade |
|---------|------------------|
| [`docs/system_design.md`](./system_design.md) | Este documento |
| [`web/src/app/globals.css`](../web/src/app/globals.css) | Tokens CSS + utilitários |
| [`web/src/app/layout.tsx`](../web/src/app/layout.tsx) | Fontes Inter + JetBrains Mono |
| [`web/src/lib/theme-store.ts`](../web/src/lib/theme-store.ts) | Toggle dark/light |

### 13.2 Migração de cyan → indigo

1. Tokens em `globals.css` (accent / ring).  
2. Substituições graduais: `cyan-*` Tailwind → `indigo-*` ou `var(--accent)`.  
3. Remover overrides “light mode força cyan” quando componentes usarem tokens.  
4. Manter `.btn-danger` definido (não só usado).

### 13.3 Convenção para PRs de UI

- [ ] Usa tokens semânticos?  
- [ ] Funciona em dark **e** light?  
- [ ] Focus visible ok?  
- [ ] Sem hardcoded `#070b10` / `#22d3ee`?  
- [ ] Contraste AA no texto?

---

## 14. Checklist de conformidade

### Design

- [ ] Um accent (indigo); semântica só para status  
- [ ] Tipografia Inter + JetBrains Mono  
- [ ] Escala 4px; radius da tabela oficial  
- [ ] Empty states com uma ação primária  

### Código

- [ ] Classes `archia-dark` / `archia-light`  
- [ ] `.btn-primary` / `.btn-ghost` / `.btn-danger`  
- [ ] Inputs com focus ring  
- [ ] Sidebar colapsável com persistência  

### A11y

- [ ] Skip link  
- [ ] Targets ≥ 24px  
- [ ] Reduced motion  
- [ ] Labels em ícones  

---

## Apêndice A — Glossário rápido

| Termo | Significado |
|-------|-------------|
| Surface | Camada de fundo (0 base → 3 elevated) |
| Accent | Cor de marca / ação primária |
| Muted | Texto ou UI secundária |
| Token | Variável nomeada de design |
| DTCG | Design Tokens Community Group format |

## Apêndice B — Histórico de decisão

| Data | Decisão |
|------|----------|
| 2026-08-21 | Rebrand: direção Figma/Notion; accent Indigo; Inter + JetBrains Mono; doc canônico criado |

---

*Documento mantido pelo time Archia. Alterações de token devem atualizar este MD e `globals.css` no mesmo PR.*
