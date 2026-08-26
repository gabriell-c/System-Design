/**
 * P3.1.3 — Glossary terms for architecture concepts.
 * Maps common terms to their definitions for hover tooltips.
 */

export type GlossaryTerm = {
  id: string;
  term: string;
  definition: string;
  category: "network" | "security" | "compute" | "data" | "cloud" | "devops" | "architecture";
  related?: string[];
};

export const GLOSSARY_TERMS: GlossaryTerm[] = [
  // Network
  {
    id: "vpc",
    term: "VPC",
    definition: "Virtual Private Cloud — rede virtual isolada na nuvem com controle de subnets, rotas e gateways.",
    category: "network",
    related: ["subnet", "igw", "nat"],
  },
  {
    id: "subnet",
    term: "Subnet",
    definition: "Sub-rede IPv4/IPv6 dentro de uma VPC. Pode ser pública (com route para IGW) ou privada.",
    category: "network",
    related: ["vpc", "acl"],
  },
  {
    id: "tgw",
    term: "Transit Gateway",
    definition: "Hub de roteamento central para conectar múltiplas VPCs e redes on-premises.",
    category: "network",
    related: ["vpc", "vpn"],
  },
  {
    id: "nat",
    term: "NAT Gateway",
    definition: "Gateway que permite instâncias em subnets privadas accessarem a internet sem IP público.",
    category: "network",
    related: ["vpc", "subnet"],
  },
  {
    id: "vpn",
    term: "VPN",
    definition: "Túnel IPsec criptografado entre VPC e rede on-premises ou outro provedor.",
    category: "network",
    related: ["tgw", "direct-connect"],
  },
  // Security
  {
    id: "sg",
    term: "Security Group",
    definition: "Firewall stateful em nível de instância. Regras de entrada e saída com allow/deny.",
    category: "security",
    related: ["nacl", "iam"],
  },
  {
    id: "nacl",
    term: "NACL",
    definition: "Network ACL — firewall stateless em nível de subnet. Avalia regras em ordem.",
    category: "security",
    related: ["sg", "waf"],
  },
  {
    id: "iam",
    term: "IAM Role",
    definition: "Identidade temporária que serviços assumem para acessar recursos com permissões definidas.",
    category: "security",
    related: ["policy", "sts"],
  },
  {
    id: "kms",
    term: "KMS",
    definition: "Key Management Service — gerenciamento de chaves de criptografia para dados em repouso e trânsito.",
    category: "security",
    related: ["encryption", "secrets"],
  },
  {
    id: "waf",
    term: "WAF",
    definition: "Web Application Firewall — proteção contra SQL injection, XSS e ataques de camada 7.",
    category: "security",
    related: ["sg", "shield"],
  },
  // Compute
  {
    id: "ecs",
    term: "ECS",
    definition: "Elastic Container Service — orquestração de containers Docker com Fargate ou EC2.",
    category: "compute",
    related: ["eks", "lambda"],
  },
  {
    id: "eks",
    term: "EKS",
    definition: "Elastic Kubernetes Service — clusters Kubernetes gerenciados na AWS.",
    category: "compute",
    related: ["ecs", "fargate"],
  },
  {
    id: "lambda",
    term: "Lambda",
    definition: "Computação serverless que executa código em resposta a eventos sem gerenciar servidores.",
    category: "compute",
    related: ["api-gateway", "eventbridge"],
  },
  // Data
  {
    id: "rds",
    term: "RDS",
    definition: "Relational Database Service — bancos SQL gerenciados (PostgreSQL, MySQL, etc.).",
    category: "data",
    related: ["dynamodb", "redshift"],
  },
  {
    id: "dynamodb",
    term: "DynamoDB",
    definition: "Banco NoSQL serverless com latência single-digit ms e escala automática.",
    category: "data",
    related: ["rds", "elasticache"],
  },
  {
    id: "elasticache",
    term: "ElastiCache",
    definition: "Redis ou Memcached gerenciado para caching de alta performance.",
    category: "data",
    related: ["rds", "dynamodb"],
  },
  // Cloud
  {
    id: "cloudfront",
    term: "CloudFront",
    definition: "CDN global da AWS para distribuição de conteúdo com baixa latência.",
    category: "cloud",
    related: ["s3", "waf"],
  },
  {
    id: "s3",
    term: "S3",
    definition: "Simple Storage Service — object storage escalável para dados, backups e static websites.",
    category: "cloud",
    related: ["cloudfront", "glacier"],
  },
  // DevOps
  {
    id: "codepipeline",
    term: "CodePipeline",
    definition: "Serviço CI/CD para automação de builds, testes e deploys.",
    category: "devops",
    related: ["codebuild", "codestar"],
  },
  {
    id: "cloudwatch",
    term: "CloudWatch",
    definition: "Monitoramento de recursos AWS, logs e alertas com métricas customizadas.",
    category: "devops",
    related: ["x-ray", "insights"],
  },
  // Architecture
  {
    id: "microservices",
    term: "Microserviços",
    definition: "Arquitetura onde aplicações são compostas por serviços pequenos e independentes.",
    category: "architecture",
    related: ["api-gateway", "service-mesh"],
  },
  {
    id: "event-driven",
    term: "Event-Driven",
    definition: "Padrão arquitetural onde serviços comunicam-se via eventos assíncronos.",
    category: "architecture",
    related: ["kafka", "sqs", "sns"],
  },
  {
    id: "circuit-breaker",
    term: "Circuit Breaker",
    definition: "Padrão que previne cascata de falhas ao interromper chamadas para serviços indisponíveis.",
    category: "architecture",
    related: ["retry", "fallback"],
  },
];

/** Busca termo por ID ou termo */
export function findGlossaryTerm(id: string): GlossaryTerm | undefined {
  return GLOSSARY_TERMS.find((t) => t.id === id || t.term.toLowerCase() === id.toLowerCase());
}

/** Busca termos por categoria */
export function getTermsByCategory(category: GlossaryTerm["category"]): GlossaryTerm[] {
  return GLOSSARY_TERMS.filter((t) => t.category === category);
}
