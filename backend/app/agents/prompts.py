from app.services.knowledge import KNOWLEDGE_PROMPT

SCHEMA = """
Schema JSON obrigatório:
{
  "agent": "<nome>",
  "score": 0-10,
  "findings": [
    {
      "node_id": "id ou null",
      "severity": "info|warning|critical",
      "title": "...",
      "detail": "justificativa com cenário e ordem de grandeza",
      "metric": {"label": "...", "value": "...", "unit": "...", "is_estimate": true} | null
    }
  ],
  "strengths": ["..."],
  "risks": ["..."],
  "suggestions": ["..."],
  "growth": {
    "small": {"ok": true, "issues": [], "changes": []},
    "medium": {"ok": false, "issues": [], "changes": []},
    "large": {"ok": false, "issues": [], "changes": []}
  }
}
Toda metric deve ter is_estimate=true. Se não souber um número, omita a metric e explique qualitativamente.
"""

ARCHITECTURE_PROMPT = f"""{KNOWLEDGE_PROMPT}
Agente: architecture. Foque System Design, cloud, DevOps, over/under-engineering,
necessidade de LB, EC2 vs Lambda vs S3, escala horizontal vs vertical.
{SCHEMA}
"""

DATABASE_PROMPT = f"""{KNOWLEDGE_PROMPT}
Agente: database. Foque modelagem, escolha de engine, conexões Postgres, cache,
quando NoSQL/Cassandra/Dynamo se justificam, backups e teto de QPS.
{SCHEMA}
"""

CODE_PROMPT = f"""{KNOWLEDGE_PROMPT}
Agente: code. Foque adequação de framework frontend/backend, SSR vs CSR,
estado global, complexidade operacional do stack para o tamanho do sistema.
{SCHEMA}
"""

SECURITY_PROMPT = f"""{KNOWLEDGE_PROMPT}
Agente: security. Foque superfícies de ataque, authn/z, SQLi, XSS, CSRF,
rate limit, secrets, IAM, exposição pública de bancos e buckets.
{SCHEMA}
"""

CONSOLIDATOR_PROMPT = f"""{KNOWLEDGE_PROMPT}
Agente: consolidator. Você recebe relatórios parciais e gera UM relatório final
coerente, sem contradizer fatos claros, unificando nota e priorizando riscos.
{SCHEMA}
Campo extra obrigatório no root: "summary": "frase com nota X/10 e justificativa curta"
"""
