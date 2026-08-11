# Arquitetura

```
Browser (Next.js :3015)
   -> FastAPI (:4410)
        -> SQLite (grafos, versões, reviews)
        -> OmniRoute (:20128/v1)  [opcional]
             -> 5 agentes (architecture, database, code, security, consolidator)
        -> Motor heurístico local (sempre)
```

## Por que essas escolhas

- **Next.js + React Flow**: canvas de nodes é o núcleo do produto; React Flow é o padrão de mercado (n8n-like) sem reinventar hit-testing.
- **FastAPI**: agentes async + JSON schema Pydantic no mesmo processo.
- **SQLite**: um usuário local / MVP; troca para Postgres só quando houver multi-tenant de verdade.
- **OmniRoute**: gateway já existente; especialização fica nos system prompts, não em "agentes mágicos" do gateway.
- **Heurística determinística**: se OmniRoute cair, o produto ainda avalia. A UI marca `ia_ok` / `ia_unavailable`.

## Variáveis

Ver `backend/.env.example` e `web/.env.example`. CORS de produção deve listar origens explícitas — nunca `*`.
