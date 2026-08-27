# Análise Completa — Diagrama Livre (Free Canvas)
> **Data:** 2026-08-26
> **Escopo:** FreePalette, FreeNode, DesignCanvas (free mode), EditorShell, Inspector (layers), PropertiesPanel
> **Autor:** Gabriel (Fábrica)

---

## 1. PALETA DE FORMAS (FreePalette.tsx)

### 1.1. Grid pequeno demais
**Problema:** `grid-cols-4 gap-1.5` com ícones `h-5 w-5` e label `text-[10px]` → botões muito apertados, difícil clique (WCAG 2.5.5).
**Solução:** Aumentar para `grid-cols-5 gap-2`, ícones `h-6 w-6`, labels `text-xs`.

### 1.2. Sem busca/filtro
**Problema:** 19 formas em 5 seções → scroll necessário, usuário não encontra rápido.
**Solução:** Adicionar input de busca no topo da paleta (igual ComponentPalette).

### 1.3. Seções separadas são desnecessárias
**Problema:** "Formas", "Setas", "Indicadores", "Mídia & links", "Texto" → fragmentação cognitiva.
**Solução:** Unificar em 1 grid com badges de categoria ou tabs internas.

### 1.4. Sem preview ao hover
**Problema:** Usuário não sabe como a forma ficará antes de clicar.
**Solução:** Tooltip com preview da forma (SVG estático) ao passar o mouse.

### 1.5. Mensagem de sucesso genérica
**Problema:** `${item?.label ?? "Forma"} adicionada.` → sem contexto do que foi adicionado.
**Solução:** "Retângulo adicionado no canvas" + feedback visual no canvas (pulse no nó).

---

## 2. NÓS LIVRES (FreeNode.tsx)

### 2.1. Losango sem rotação reversa no texto
**Problema:** `transform: rotate(45deg)` no container, mas `rotate(-45deg)` no texto → texto torto.
**Código:** Linha 27 e 218 conflitam.
**Solução:** Aplicar rotação apenas no container, nunca no texto.

### 2.2. Triângulo com texto inválido
**Problema:** `clipPath` corta o texto quando rotate(-45deg) é aplicado.
**Solução:** Remover rotação do texto para triângulo também, ou usar rotação diferente.

### 2.3. Handles de conexão só aparecem ao selecionar
**Problema:** `AnchorHandle` só aparece quando `selected=true` → usuário não sabe que pode conectar.
**Solução:** Mostrar handles com opacidade 40% sempre, 100% ao hover/select.

### 2.4. Resizer sem feedback visual
**Problema:** `NodeResizer` com handles `!h-2 !w-2` → quase invisíveis.
**Solução:** Aumentar para `h-3 w-3` e usar cor `var(--accent)` visível.

### 2.5. Textarea sem limite de altura
**Problema:** `textarea` com `h-full resize-none` → texto muito longo quebra layout.
**Solução:** Adicionar `max-h-48 overflow-y-auto` e auto-grow.

### 2.6. Nota (free-note) com RichTextEditor pesado
**Problema:** Carrega editor rich text completo para uma nota simples.
**Solução:** Usar textarea simples com markdown básico, só rich text se usuário pedir.

### 2.7. Link sem validação de URL
**Problema:** `free-link` com `href="https://"` → link quebrado se usuário não editar.
**Solução:** Validar URL no onChange e mostrar warning se inválida.

---

## 3. CANVAS (DesignCanvas.tsx - free mode)

### 3.1. Sem snap/grade no free mode
**Problema:** `if (!_lod.snapEnabled || isFreeMode)` → desativa snap no free, mas usuário precisa de guia.
**Solução:** Manter snap fraco (8px) mesmo no free mode.

### 3.2. MiniMap não mostra nós free
**Problema:** `nodeColor` só trata `zone`, `block`, resto é `#475569` → perde informação.
**Solução:** Usar cor diferente para free nodes (`#6366f1`).

### 3.3. Background de pontos muito discreto
**Problema:** `color="#1e293b"` → quase invisível no dark.
**Solução:** Aumentar opacidade para `color="rgba(30,41,59,0.5)"`.

### 3.4. Controls de zoom sem label
**Problema:** Botões de zoom sem indicador de nível atual.
**Solução:** Mostrar badge com `%` de zoom (já existe state `zoomLevel` mas não é usado).

### 3.5. TitleBlock fixo no canto
**Problema:** `absolute bottom-4 left-4` → sobrepõe conteúdo em telas pequenas.
**Solução:** Tornar colapsável ou mover para TopBar.

### 3.6. Sem atalhos de teclado para formas
**Problema:** Usuário precisa clicar na paleta para cada forma.
**Solução:** Atalhos: `R` retângulo, `C` círculo, `D` losango, `T` texto, `N` nota.

---

## 4. FLUXO DE EDIÇÃO

### 4.1. Dificuldade para conectar nós
**Problema:** Precisa selecionar nó → ver handle → arrastar → selecionar destino.
**Solução:** Duplo-clique em nó habilita modo conexão (atalho `C`), ESC cancela.

### 4.2. Sem histórico de camadas visual
**Problema:** Painel "Camadas" mostra ordem, mas usuário não vê efeito no canvas.
**Solução:** Highlight do nó selecionado no painel + pulse no canvas.

### 4.3. Delete só com tecla
**Problema:** `deleteKeyCode={null}` → removido no canvas, usuário perde delete por acidente.
**Solução:** Restaurar Delete/Backspace + botão de lixeira no inspector.

### 4.4. Undo/Redo sem indicador
**Problema:** Usuário não sabe quantas ações pode desfazer.
**Solução:** Badge no TopBar mostrando `↶ 3` / `↷ 2`.

---

## 5. INSPETOR (LayerHierarchyPanel.tsx)

### 5.1. Sem drag-and-drop para reordenar
**Problema:** Só tem setas ↑↓ → lento para muitos nós.
**Solução:** Adicionar drag-and-drop (dnd-kit) para reordenar visualmente.

### 5.2. Não mostra qual nó está selecionado
**Problema:** Highlight azul no item da lista, mas usuário pode não notar.
**Solução:** Scroll automático para item selecionado + borda mais forte.

### 5.3. Contagem de nós sem contexto
**Problema:** `{freeNodes.length} nós` → e os arquétipos?
**Solução:** "5 livres · 3 arquétipos" ou separar abas.

### 5.4. Dica no final é genérica
**Problema:** "Nós mais altos ficam por cima..." → óbvio, não ajuda.
**Solução:** Remover dica ou mudar para "Dica: Use Ctrl+C para copiar camada".

---

## 6. PROPIEDADES (PropertiesPanel.tsx - free)

### 6.1. Muitas abas para free
**Problema:** Abas "Props", "Camadas" separam o que deveria estar junto.
**Solução:** Unificar em 1 painel com seções colapsáveis.

### 6.2. Sem cor personalizável por tipo
**Problema:** `free-check` já tem cor fixa (`bg-emerald-500/20`), usuário não pode mudar.
**Solução:** Permitir trocar cor no PropertiesPanel.

### 6.3. Sem tamanho preset
**Problema:** Usuário precisa arrastar para redimensionar → impreciso.
**Solução:** Presets: Pequeno, Médio, Grande, XL.

### 6.4. Textarea de label truncado
**Problema:** `label: val.slice(0, 60)` → texto cortado sem aviso.
**Solução:** Remover limite ou mostrar "..." com tooltip.

---

## 7. ICONES E LABELS

### 7.1. Inconsistência de ícones
**Problema:** `free-arrow-double` usa `Zap` (raio) em vez de seta bidirecional.
**Solução:** Usar `ArrowsLeftRight` do lucide.

### 7.2. Labels em português vs inglês
**Problema:** "Seta ↔" vs "Check" vs "Áudio" → mistura idiomas.
**Solução:** Padronizar para PT-BR: "Seta dupla", "Check", "Áudio".

### 7.3. Descrição em chinês no catalog
**Problema:** `description: "Fluxo双向"` (双向 = bidirecional em chinês).
**Solução:** Corrigir para "Fluxo bidirecional".

---

## 8. CORES E CONTRASTE

### 8.1. Bordas muito finas
**Problema:** `border-2` em formas → difícil ver em telas HD.
**Solução:** `border-[1.5px]` com cor mais contraste (`border-[var(--border-strong)]`).

### 8.2. Fundo de setas confuso
**Problema:** `bg-[var(--accent-muted)]` em setas → mesmo visual que retângulo selecionado.
**Solução:** Cor diferente para setas (`bg-indigo-500/10`).

### 8.3. Nota amarela hardcoded
**Problema:** `backgroundColor: "#fef08a"` → fixo, não respeita tema.
**Solução:** Usar token `--warning-bg` ou cor do tema.

---

## 9. ORGANIZAÇÃO E FLUXO

### 9.1. Paleta muito alta
**Problema:** Scroll vertical necessário → usa espaço precioso.
**Solução:** Grid 3 colunas em vez de 4, ou tabs horizontais.

### 9.2. Sem agrupamento por uso
**Problema:** Formas básicas e mídias misturadas → dificuldade de encontrar.
**Solução:** Agrupar: "Formas", "Fluxo", "Estado", "Conteúdo".

### 9.3. Canvas vazio sem guidance
**Problema:** Canvas em branco não diz como começar.
**Solução:** Onboarding com dica: "Clique em uma forma na paleta para começar".

---

## 10. PERFORMANCE

### 10.1. Muitos re-renders
**Problema:** `nodes` no `useMemo` da paleta → recalcula a cada ação.
**Solução:** Cache por `nodes.length` em vez de referência.

### 10.2. FreeNode não usa memo corretamente
**Problema:** `memo(FreeNodeInner)` mas props mudam a cada render.
**Solução:** Estabilizar callbacks com `useCallback`.

---

## 11. ACESSIBILIDADE

### 11.1. Botões da paleta sem label suficiente
**Problema:** `title={item.description}` → tooltip só no hover, não acessível por teclado.
**Solução:** Adicionar `aria-label={item.label}`.

### 11.2. Focus ring invisível
**Problema:** `focus-visible:ring-2 focus-visible:ring-[var(--accent)]` → pouco contraste.
**Solução:** `ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--background)]`.

### 11.3. Alt text em imagens
**Problema:** `alt={data.label}` → se label vazio, alt vazio.
**Solução:** `alt={data.label || "Imagem"}`.

---

## 12. FLUXO DE TRABALHO

### 12.1. Sem template vazio
**Problema:** Usuário começa do zero → difícil saber por onde começar.
**Solução:** Templates: "Fluxograma simples", "Processo", "Decisão".

### 12.2. Sem auto-layout
**Problema:** Nós ficam desordenados → usuário perde tempo organizando.
**Solução:** Botão "Organizar" que alinha em grade.

### 12.3. Dificuldade para selecionar nó de trás
**Problema:** Nó coberto por outro → precisa mover primeiro.
**Solução:** Shift+clique seleciona nó abaixo do mouse.

---

## 13. EXPORTAÇÃO

### 13.1. Sem exportar só nós livres
**Problema:** Export PDF/ PNG exporta canvas inteiro.
**Solução:** Opção "Exportar seleção" no menu.

### 13.2. Sem copiar como SVG
**Problema:** Usuário quer usar forma em outro tool.
**Solução:** Botão "Copiar SVG" ao selecionar nó.

---

## 14. MICROINTERAÇÕES

### 14.1. Sem feedback ao adicionar nó
**Problema:** Nó aparece sem animação → não óbvio que foi adicionado.
**Solução:** Scale 0→1 com spring animation.

### 14.2. Sem feedback ao conectar
**Problema:** Edge aparece subitamente.
**Solução:** Draw animation da borda.

### 14.3. Sem shake em erro
**Problema:** URL inválida não avisa visualmente.
**Solução:** Shake no input + border vermelha.

---

## 15. DOCUMENTAÇÃO

### 15.1. Sem tooltip de ajuda
**Problema:** Usuário não sabe o que cada forma faz.
**Solução:** `?` ao lado do nome da forma na paleta.

### 15.2. Sem atalhos listados
**Problema:** Atalhos de teclado não são descobertos.
**Solução:** Botão "?" no canvas mostra atalhos.

---

## PRIORIDADES SUGERIDAS

| Prioridade | Item | Impacto | Esforço |
|------------|------|---------|---------|
| P0 | Corrigir texto do losango/triângulo | UX grave | Baixo |
| P0 |Handles visíveis sempre | Usabilidade | Baixo |
| P1 | Busca na paleta | Eficiência | Médio |
| P1 | Snap/grade no free mode | Precisão | Baixo |
| P1 | Drag-drop no painel Camadas | Produtividade | Médio |
| P2 | Templates iniciais | Onboarding | Médio |
| P2 | Atalhos de teclado | Produtividade | Baixo |
| P2 | Auto-layout | Organização | Alto |
| P3 | Preview na paleta | Descoberta | Médio |
| P3 | Exportar seleção | Flexibilidade | Baixo |

---

*Documento gerado por análise de código-fonte. Recomenda-se revisão com usuários reais para validar prioridades.*