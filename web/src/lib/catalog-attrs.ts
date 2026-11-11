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
  "mc-azure-functions": { maxRps: 800, ha: "regional", regions: ["*"] },
  "mc-azure-apim": { maxRps: 40000, ha: "regional", regions: ["*"] },
  // Bancos populares — limites aproximados de single-instance
  "db-postgres": { maxRps: 20000, ha: "multi_az", regions: ["*"], notes: "Vertical até ~Tens of thousands de ops/s; sharding p/ mais" },
  "db-mysql": { maxRps: 15000, ha: "multi_az", regions: ["*"] },
  "db-mongo": { maxRps: 25000, ha: "regional", regions: ["*"], notes: "Replica set p/ HA" },
  "db-redis": { maxRps: 100000, ha: "multi_az", regions: ["*"], notes: "In-memory; cluster p/ escala horizontal" },
  "db-dynamo": { maxRps: 100000, ha: "global", regions: ["*"], notes: "Provisioned/On-Demand WCU" },
  // Filas / streaming
  "int-kafka": { maxRps: 200000, ha: "multi_az", regions: ["*"], notes: "Broker cluster; ~50k msg/s p/ broker" },
  "int-sqs": { maxRps: 50000, ha: "multi_az", regions: ["*"], notes: "Burst até 10k p/ fila" },
  "int-rabbit": { maxRps: 20000, ha: "regional", regions: ["*"] },
  "int-nats": { maxRps: 50000, ha: "multi_az", regions: ["*"] },
  // Observabilidade
  "obs-prometheus": { maxRps: 50000, ha: "multi_az", regions: ["*"], notes: "samples/sec p/ um server" },
};

export function getCatalogAttributes(catalogId: string): CatalogAttributes | null {
  const spec = ATTRS[catalogId];
  if (!spec) return null;
  return { catalogId, ...spec };
}

export function listCatalogAttributes(): CatalogAttributes[] {
  return Object.entries(ATTRS).map(([catalogId, rest]) => ({ catalogId, ...rest }));
}
