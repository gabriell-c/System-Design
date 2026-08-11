import { CATALOG, findCatalog } from "./catalog";

export interface StackRecommendation {
  id: string;
  techId: string;
  title: string;
  description: string;
  reason: string;
  category: string;
}

const RECOMMENDATION_RULES: Record<string, { techId: string; reason: string }[]> = {
  "react-native": [
    { techId: "typescript", reason: "TypeScript is strongly recommended with React Native for better type safety and DX." },
    { techId: "expo", reason: "Expo simplifies React Native development with managed workflows." },
  ],
  "flutter": [
    { techId: "dart", reason: "Flutter uses Dart as its primary language." },
  ],
  "nextjs": [
    { techId: "typescript", reason: "TypeScript is the recommended language for Next.js projects." },
    { techId: "tailwind", reason: "Tailwind CSS is the most popular styling solution for Next.js." },
  ],
  "nuxtjs": [
    { techId: "typescript", reason: "TypeScript improves type safety in Nuxt.js applications." },
    { techId: "vue", reason: "Vue.js is the underlying framework for Nuxt.js." },
  ],
  "django": [
    { techId: "python", reason: "Django is a Python web framework." },
    { techId: "postgresql", reason: "PostgreSQL is the recommended database for Django production use." },
  ],
  "flask": [
    { techId: "python", reason: "Flask is a Python micro-framework." },
  ],
  "express": [
    { techId: "typescript", reason: "TypeScript with Express provides better maintainability." },
    { techId: "nodejs", reason: "Express runs on Node.js." },
  ],
  "nestjs": [
    { techId: "typescript", reason: "NestJS is designed for TypeScript." },
    { techId: "nodejs", reason: "NestJS runs on Node.js." },
  ],
  "postgresql": [
    { techId: "prisma", reason: "Prisma is a popular ORM for PostgreSQL in TypeScript projects." },
  ],
  "mongodb": [
    { techId: "mongoose", reason: "Mongoose is the standard ODM for MongoDB in Node.js." },
  ],
  "redis": [
    { techId: "nodejs", reason: "Redis commonly pairs with Node.js for caching and sessions." },
  ],
  "aws": [
    { techId: "docker", reason: "Docker is commonly used for deploying to AWS services like ECS and EKS." },
  ],
  "docker": [
    { techId: "kubernetes", reason: "Kubernetes orchestrates Docker containers in production." },
  ],
  "kubernetes": [
    { techId: "docker", reason: "Kubernetes requires containerized applications." },
  ],
  "graphql": [
    { techId: "typescript", reason: "TypeScript with GraphQL provides end-to-end type safety." },
  ],
  "supabase": [
    { techId: "postgresql", reason: "Supabase is built on PostgreSQL." },
    { techId: "typescript", reason: "Supabase has excellent TypeScript support." },
  ],
  "firebase": [
    { techId: "typescript", reason: "Firebase JavaScript SDK works best with TypeScript." },
  ],
  "tailwind": [
    { techId: "react", reason: "Tailwind CSS pairs excellently with React for utility-first styling." },
  ],
  "sass": [
    { techId: "react", reason: "SASS is a popular CSS preprocessor for React projects." },
  ],
  "webpack": [
    { techId: "typescript", reason: "Webpack bundles TypeScript projects with appropriate loaders." },
  ],
  "vite": [
    { techId: "typescript", reason: "Vite has excellent TypeScript support out of the box." },
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
          title: catalogItem.name,
          description: catalogItem.description ?? "",
          reason: rule.reason,
          category: catalogItem.category,
        });
      }
    }
  }

  return recommendations;
}
