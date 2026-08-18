# Arquitetura real (zonas + fluxos tipados)

O Archia modela **arquitetura de software** além da escolha de stack: zonas aninhadas multi-cloud, fluxos tipados/numerados, templates de referência e análise de coerência.

## Modelo

| Conceito | Descrição |
|----------|-----------|
| **Zone** | Contêiner cloud-agnostic: `region`, `vpc`, `availability_zone`, `subnet_public`, `subnet_private`, `layer`, `plane`, `security_boundary` |
| **Block** | Agrupador de stack (FE/BE/DB…) — continua suportado |
| **Card** | Serviço/tecnologia (AWS/Azure/GCP + stack) |
| **ArchEdgeData** | `flowKind` (sync/async/data/control/management), `protocol`, `flowNumber`, `label` |

Nesting: zonas aninham zonas conforme árvore (ex. Region → VPC → AZ → Subnet). Cards entram em qualquer zona. Blocos de stack ainda exigem mesmo domínio.

## Paleta

- Seção **Zonas de arquitetura**
- Filtro de provider: Todos / AWS / Azure / GCP
- Catálogo multi-cloud por *capability* (`catalog-multicloud.ts`)

## Templates

Em Contexto → templates:

1. `aws-serverless-api-authorizer`
2. `aws-multi-az-app`
3. `azure-data-pipeline`
4. `aws-load-testing-control-data-plane`

Cada um nasce com zones + fluxos numerados.

## Análise

Painel **Arquitetura**: estilo (declarado/detectado), chips AN/AD, coerência, trade-offs, **review scorecard**, riscos de zona.

Heurísticas (`analyze_zone_structure` + `build_review_scorecard`):

- Dado em subnet pública (critical)
- Edge + compute sem AuthZ
- VPC sem subnet privada
- Uma única AZ
- Messaging sem fluxo async tipado
- Clareza narrativa, continuity de fluxo, placement, operabilidade, decisão explícita

Ver [PADRAO-DIAGRAMA-ARQUITETURA.md](../PADRAO-DIAGRAMA-ARQUITETURA.md).

## Arquivos-chave

- `web/src/lib/zones.ts`, `edges.ts`, `templates-architecture.ts`, `catalog-multicloud.ts`
- `web/src/components/nodes/ZoneNode.tsx`
- `web/src/components/panels/ArchitecturePanel.tsx`
- `backend/app/services/architecture_heuristics.py`
