# Editor visual

Canvas React Flow com **blocos** (containers) e **cards** (tecnologias).

## Fluxo principal (kickoff → desenho → julgamento)

1. **Contexto** — brief + NFRs + template (stack **ou** arquitetura real AWS/Azure).
2. **Kickoff** — checklist do que falta (auth, obs, dados, ambientes…).
3. **Zonas + cards** — Region/VPC/AZ/Subnet/Plane **ou** blocos de stack (FE/BE/…).
4. **Fluxos tipados** — sync/async com número; edite na aba Props ao selecionar a linha.
5. **Arquitetura / Analisar / Simular** — coerência AN/AD/AA/AI, riscos de zona, carga.
6. **ADRs** (menu Mais) — decisões leves para copiar ao repo.

## UI

| Área | Papel |
|------|--------|
| Top bar | Nome, undo/redo, **Tela cheia**, **Exportar**, **Salvar**, **Analisar**, menu **Mais** |
| Paleta | Zonas · Blocos · Cards multi-cloud (filtro AWS/Azure/GCP) |
| Canvas | Empty state com zonas; legenda de tipos de fluxo; templates via Contexto |
| Inspetor | Contexto · Kickoff · Props · **Arquitetura** · Análise · Simulação · Mais |

Ver também: [arquitetura-real.md](./arquitetura-real.md).

## Paleta (sidebar esquerda)

- **Zonas de arquitetura** — Region, VPC, AZ, Subnets, Layer, Plane, Security.
- **Passo 1 · Blocos** — grid 2 col (stack domains).
- **Cards por domínio** — accordion + filtro de cloud provider.
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
