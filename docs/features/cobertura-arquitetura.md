# Cobertura de arquitetura (kickoff → operação)

O Archia deixou de ser só “FE/BE/DB/Cloud” e passou a cobrir o funil de início de projeto.

## Domínios no canvas

| Kind | Uso |
|---|---|
| frontend / backend / database / cloud | Stack clássica (cloud com camada compute/data/edge/platform) |
| messaging | Filas e streams (SQS, Rabbit, Kafka, Redis Streams) |
| identity | Auth (Cognito, Auth0, Keycloak, JWT) |
| observability | Prometheus, Grafana, OTel, Sentry, CloudWatch |
| integration | Stripe, Mercado Pago, SendGrid, WhatsApp, Webhooks |

## Kickoff estruturado

1. **Contexto** — brief + **NFRs** (escala, budget, SLA, compliance, time, prazo) + caminho até produção (dev/staging/prod/CI/backups/monitoramento)
2. **Templates** — MVP barato, SaaS B2B, Marketplace, API interna
3. **Kickoff** — checklist automático do que falta (auth, obs, dados, ambientes…)
4. **ADRs** — decisões leves geradas do canvas (copiar Markdown)
5. **Análise / Simulação** — julgamento + carga/jornada

## Persistência

- `graphs.context_text` — brief
- `graphs.nfr_json` — NFRs estruturados
- Export JSON inclui `nfr`
