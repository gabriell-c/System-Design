/** P1.1 — Atributos de catálogo (limite/HA/região) por catalogId. */

export type CatalogAttributes = {
  catalogId: string;
  maxRps?: number;
  ha?: "single_az" | "multi_az" | "regional" | "global";
  regions?: string[];
  notes?: string;
};

const ATTRS: Record<string, Omit<CatalogAttributes, "catalogId">> = {
  "cloud-aws-rds": { maxRps: 8000, ha: "multi_az", regions: ["us-east-1", "eu-west-1"], notes: "Provisioned IOPS" },
  "cloud-aws-lambda": { maxRps: 1000, ha: "regional", regions: ["*"], notes: "Concurrency account limit" },
  "cloud-aws-alb": { maxRps: 100000, ha: "multi_az", regions: ["*"] },
  "cloud-aws-ecs": { maxRps: 50000, ha: "multi_az", regions: ["*"] },
  "db-redshift": { maxRps: 2000, ha: "multi_az", regions: ["us-east-1"] },
  "cloud-az-func": { maxRps: 800, ha: "regional", regions: ["*"] },
  "cloud-az-apim": { maxRps: 40000, ha: "regional", regions: ["*"] },
};

export function getCatalogAttributes(catalogId: string): CatalogAttributes | null {
  const spec = ATTRS[catalogId];
  if (!spec) return null;
  return { catalogId, ...spec };
}

export function listCatalogAttributes(): CatalogAttributes[] {
  return Object.entries(ATTRS).map(([catalogId, rest]) => ({ catalogId, ...rest }));
}
