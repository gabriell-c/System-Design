# Melhorias UX do diagrama livre (canvas)

## Escopo
Toolbar sticky/colapsável, zoom/fit, badge Livre/Arquitetura, a11y (aria + focus rings), tema alto contraste, histórico persistente (sessionStorage), multi-select, color picker com presets, biblioteca de templates, export com opções (margem/resolução), MiniMap redimensionável + breadcrumbs, sort-utils, share read-only (`/share/{token}`), anotações por nó.

## APIs
- `POST /api/v1/share/graphs/{id}` → token + URL
- `GET /api/v1/share/{token}` → payload read-only
- `GET|POST /api/v1/graphs/{id}/annotations` · `DELETE .../annotations/{id}`

## UI
- Toolbar: `web/src/components/ui/Toolbar.tsx`
- Canvas: `DesignCanvas.tsx` (zoom, multi-select, MiniMap size)
- Tema: `theme-store.tsx` (`dark` | `light` | `high-contrast`)
- Export: `ExportOptionsModal.tsx` + `resolveBoardExportOptions` em `export-board.ts`

## Testes
- Backend: `tests/test_share_annotations.py` — 2 passed
- E2E: `web/e2e/diagram-improvements.spec.ts` — 5 testes (health, theme, share shell, canvas free, export modal, toolbar persist)

## Migrações
- `alembic/versions/0004_graphs_share_token.py` — add share_token na tabela graphs

## Personalização de nós livres
Campos em `FreeNodeData` (`types.ts`): borda (width/style), opacidade, tipografia, alinhamento, sombra, ícone Lucide, gradiente, padrão de preenchimento, hover.

- Render: `FreeNode.tsx` + classes `.free-node-hover-*` em `globals.css`
- Painel: seção Aparência em `PropertiesPanel.tsx`
- Pickers: `NodeShadowPicker`, `NodeIconPicker`, `NodeGradientPicker`, `NodeFillPatternPicker`
- Catálogo: `defaultIcon` em `free-catalog.ts` → aplicado em `addFreeNode`
- Ícones: `free-icons.ts` (mapa Lucide)
- Fix: callbacks do ReactFlow memoizados com `useCallback` (DesignCanvas.tsx); guard `fitViewTriggeredRef` evita loop de fitView
- Backward compatible: nós sem os campos novos renderizam com defaults.

## Notas
- Feature flag: `NEXT_PUBLIC_NEW_UI=0` desliga novas UX (padrão on)
- Templates já existiam no graph-store (`applyFreeTemplate`); agora também visíveis na UI
- Color picker existente (`ColorField`) foi substituído por `NodeColorPicker` com presets
- Anotações usam a tabela `comments` existente (node_id != null)
- Share usa share_token no Graph (não no Project)
