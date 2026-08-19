# Diagramas board-ready (P0.2)

## Title block + legenda

- **Canvas:** overlay em `TitleBlock.tsx` + `DiagramLegend.tsx` (canto inferior).
- **Export PNG board-ready:** menu Exportar → **PNG board-ready** — compõe title block (nome, autor, versão, data, NFR) + legenda no artefato via `export-board.ts` / `export-canvas.ts`.
- **PDF:** diagrama embutido já inclui title block + legenda.

## Fluxos numerados

- Arestas criadas recebem `flowNumber` automático (`nextFlowNumber` em `onConnect`).
- Tipo de aresta `flowBadge` + componente `FlowBadgeEdge.tsx` com badge circular.
- Templates scale numeram fluxos críticos (1…N).

## Swimlanes

- Tipos: `frontend`, `backend`, `database`, `dev_flow`, `user_flow`.
- Paleta → **Swimlanes (camadas)**; drag-drop `application/system-design-swimlane`.
- Nesting: cards compatíveis com a camada (dev/user aceitam qualquer card arch).

## Rede enterprise (P2.3)

- Nós: `SecurityGroupNode`, `NaclNode`, `TransitGatewayNode` (catálogo `sec-sg`, `net-nacl`, `net-tgw`).
- API: `GET /api/v1/graphs/{id}/network-policy` — valida SG/NACL/TGW e tráfego entre zonas.

## CI/CD Dev/User (P2.3)

- Template `cicd-dev-user` + manifest em `templates/cicd-dev-user/`.
- API: `GET /api/v1/graphs/{id}/deployment-flows` — separa arestas dev vs user vs cross-flow.
