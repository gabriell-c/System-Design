import { findCatalog } from "./catalog";

export interface StackRecommendation {
  id: string;
  techId: string;
  title: string;
  description: string;
  reason: string;
  category: string;
}

/** Regras de stack: chave = id real adicionado ao canvas; techId = id real sugerido. */
export const RECOMMENDATION_RULES: Record<string, { techId: string; reason: string }[]> = {
  "fe-react": [
    { techId: "lang-typescript", reason: "TypeScript dá segurança de tipo e DX a React." },
    { techId: "lib-tailwind", reason: "Tailwind é o padrão de estilo para projetos React." },
    { techId: "lib-zustand", reason: "Zustand é um estado leve e comum em React." },
  ],
  "fe-next": [
    { techId: "lang-typescript", reason: "TypeScript é a linguagem recomendada no Next.js." },
    { techId: "lib-tailwind", reason: "Tailwind é o estilo mais usado com Next.js." },
  ],
  "fe-astro": [
    { techId: "lang-typescript", reason: "Astro é fortemente voltado a TypeScript." },
  ],
  "be-django": [
    { techId: "lang-python", reason: "Django é um framework Python." },
    { techId: "db-postgres", reason: "PostgreSQL é o banco recomendado para Django em produção." },
  ],
  "be-flask": [
    { techId: "lang-python", reason: "Flask é um microframework Python." },
  ],
  "be-fastapi": [
    { techId: "lang-python", reason: "FastAPI é um framework Python async." },
  ],
  "be-express": [
    { techId: "lang-typescript", reason: "TypeScript com Express melhora a manutenibilidade." },
    { techId: "lang-javascript", reason: "Express roda em Node.js." },
  ],
  "be-nest": [
    { techId: "lang-typescript", reason: "NestJS foi desenhado para TypeScript." },
  ],
  "be-graphql": [
    { techId: "lang-typescript", reason: "TypeScript dá segurança de tipo ponta a ponta com GraphQL." },
    { techId: "lib-trpc", reason: "tRPC é uma alternativa tipada para APIs de backend." },
  ],
  "db-postgres": [
    { techId: "lib-prisma", reason: "Prisma é um ORM popular para PostgreSQL." },
    { techId: "lib-drizzle", reason: "Drizzle é um ORM leve e tipado para PostgreSQL." },
  ],
  "db-mongo": [
    { techId: "lang-typescript", reason: "MongoDB costuma ser consumido via Node/TS." },
  ],
  "db-redis": [
    { techId: "int-redis-streams", reason: "Redis Streams estende o Redis para filas/eventos." },
  ],
  "db-supabase": [
    { techId: "id-supabase-auth", reason: "Supabase Auth é o auth integrado ao Supabase." },
    { techId: "db-postgres", reason: "Supabase é construído sobre PostgreSQL." },
  ],
  "id-firebase": [
    { techId: "lang-typescript", reason: "O SDK JS do Firebase funciona melhor com TypeScript." },
  ],
  "cloud-aws-lambda": [
    { techId: "cloud-aws-s3", reason: "S3 é o armazenamento padrão para dados de Lambda." },
    { techId: "int-sqs", reason: "SQS decouple eventos para processamento assíncrono." },
  ],
  "cloud-docker": [
    { techId: "dep-compose", reason: "Docker Compose orquestra múltiplos containers localmente." },
    { techId: "dep-k8s", reason: "Kubernetes orquestra containers em produção." },
  ],
  "dep-docker": [
    { techId: "dep-k8s", reason: "Kubernetes orquestra containers em produção." },
    { techId: "dep-compose", reason: "Compose para ambientes locais de desenvolvimento." },
  ],
  "dep-k8s": [
    { techId: "dep-docker", reason: "Kubernetes exige aplicações containerizadas." },
  ],
  "cloud-vercel": [
    { techId: "fe-next", reason: "Vercel é a plataforma de home para Next.js." },
  ],
  "obs-prometheus": [
    { techId: "obs-grafana", reason: "Grafana é o painel padrão para métricas do Prometheus." },
    { techId: "obs-otel", reason: "OpenTelemetry alimenta traços para o mesmo stack de observabilidade." },
  ],
  "int-kafka": [
    { techId: "obs-otel", reason: "Instrumentar o pipeline com OpenTelemetry rastreia eventos ponta a ponta." },
  ],
};

export function checkRecommendations(
  addedTechId: string,
  existingTechs: string[]
): StackRecommendation[] {
  const recommendations: StackRecommendation[] = [];
  const existingSet = new Set(existingTechs);

  const rules = RECOMMENDATION_RULES[addedTechId] ?? [];
  for (const rule of rules) {
    if (!existingSet.has(rule.techId)) {
      const catalogItem = findCatalog(rule.techId);
      if (catalogItem) {
        recommendations.push({
          id: `rec-${addedTechId}-${rule.techId}`,
          techId: rule.techId,
          title: catalogItem.label,
          description: catalogItem.description ?? "",
          reason: rule.reason,
          category: catalogItem.category ?? "service",
        });
      }
    }
  }

  return recommendations;
}
