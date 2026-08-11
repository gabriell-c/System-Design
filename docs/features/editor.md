# Editor visual

Canvas React Flow com **blocos** (containers) e **cards** (tecnologias).

## Fluxo principal (kickoff → desenho → julgamento)

1. **Contexto** — brief + NFRs + template (MVP / SaaS / Marketplace / API interna).
2. **Kickoff** — checklist do que falta (auth, obs, dados, ambientes…).
3. **Bloco + cards** — 8 domínios (FE/BE/Dados/Infra/Mensageria/Identidade/Obs/Integrações).
4. **Analisar / Simular** — faz sentido? aguenta carga?
5. **ADRs** (menu Mais) — decisões leves para copiar ao repo.

## UI

| Área | Papel |
|------|--------|
| Top bar | Nome, undo/redo, **Tela cheia**, **Exportar**, **Salvar**, **Analisar**, menu **Mais** |
| Paleta | Busca + blocos (grid) + cards por domínio com accordion colapsável |
| Canvas | Empty state + atalhos; templates via Contexto; modo foco (só canvas) |
| Inspetor | Contexto · Kickoff · Props · Análise · Simulação · Mais (ADRs, Revisão, Histórico, IA) |

## Paleta (sidebar esquerda)

- **Passo 1 · Blocos** — grid 2 col, sempre visível.
- **Cards por domínio** — cada seção tem accordion (clicável) com ícone, nome e contagem.
- Estado de colapso salvo em `localStorage` (`archia-palette-collapsed`).
- Botão **Expandir / Recolher** tudo no topo.
- Ao buscar, todas as seções abrem automaticamente.
- **Catálogo completo**: ~80+ tecnologias em 8 domínios — frameworks, linguagens, libs, serviços cloud, devops.

## Exportação

Botão **Exportar** na top bar:

| Formato | Uso |
|---------|-----|
| **JSON** | Snapshot reimportável (`format: system-design-saas.graph`) |
| **PNG** | Imagem do diagrama (canvas React Flow) |
| **Markdown** | Doc com contexto, NFRs, componentes, conexões e análise |
| **PDF** | Abre impressão com diagrama + texto — use “Salvar como PDF” |

Importação continua em **Mais → Importar JSON**.

## Regras importantes

- Card só entra em bloco do **mesmo domínio** (aviso se tentar o contrário).
- **Duplo clique** no ponto ou na linha remove a ligação.
- Sidebars redimensionáveis; largura persiste em `localStorage`.
- **Tela cheia / foco** (`F`): esconde top bar + paleta + inspetor; `Esc` ou botão **Sair** restaura. Preferência em `localStorage` (`archia-focus-mode`).
- **Snap de alinhamento**: ao arrastar, itens alinham automaticamente (8px threshold) com guideline cyan. Blocos alinham entre blocos, cards entre cards.
- Toasts unificados (`uiNotice`) para salvar, analisar, simular e erros.

| Atalho | Ação |
|--------|------|
| Ctrl+Z | Desfazer |
| Shift+Z / Ctrl+Shift+Z / Ctrl+Y | Refazer |
| Delete / Backspace | Apagar seleção |
| F | Alternar tela cheia do canvas |
| Esc | Sair da tela cheia |

## Persistência

- Zustand (`graph-store`) com histórico undo/redo
- Export/import JSON inclui contexto e hierarquia
- Versões e lista em `/graphs`
