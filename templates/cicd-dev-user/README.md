# CI/CD Dev/User — Template Manifest

Template dual-flow para separar **fluxo Dev (CI/CD)** e **fluxo User (runtime)** no Archia.

## Estrutura

| Swimlane | `swimlaneKind` | Estágios |
|----------|----------------|----------|
| Dev | `dev_flow` | Git → Actions → Jenkins → Docker → Jest → K8s → ArgoCD |
| User | `user_flow` | CloudFront → API GW → ECS/Lambda → RDS/Redis → Prometheus/Grafana/Alertmanager |

## Cross-flow

- `ArgoCD → ECS` (rollout deploy → runtime)
- `Alertmanager → Git` (notify on incident)

## API de validação

```
GET /api/v1/graphs/{id}/deployment-flows
```

Retorna contagem de nós/arestas por fluxo e gaps (ex.: sem cross-flow).

## Aplicar no editor

Use o template **CI/CD Dev/User** ou **CI/CD Pipeline (Dev + User)** na galeria de templates scale.
