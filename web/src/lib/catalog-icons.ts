/** P0.2.1 — Mapeamento catalogId → ícone oficial (SVG path ou fallback). */

export type OfficialIconSpec = {
  provider: "aws" | "azure" | "gcp" | "generic";
  /** Nome do serviço no Architecture Icons set */
  service: string;
  color: string;
};

const AWS: Record<string, OfficialIconSpec> = {
  "cloud-aws-alb": { provider: "aws", service: "Elastic-Load-Balancing", color: "#FF9900" },
  "cloud-aws-apigw": { provider: "aws", service: "API-Gateway", color: "#FF9900" },
  "cloud-aws-cf": { provider: "aws", service: "CloudFront", color: "#FF9900" },
  "cloud-aws-ecs": { provider: "aws", service: "ECS", color: "#FF9900" },
  "cloud-aws-lambda": { provider: "aws", service: "Lambda", color: "#FF9900" },
  "net-aws-nat": { provider: "aws", service: "NAT-Gateway", color: "#FF9900" },
  "net-aws-peering": { provider: "aws", service: "VPC-Peering", color: "#FF9900" },
  "net-aws-vpn": { provider: "aws", service: "Site-to-Site-VPN", color: "#FF9900" },
  "net-aws-dx": { provider: "aws", service: "Direct-Connect", color: "#FF9900" },
  "net-aws-privatelink": { provider: "aws", service: "PrivateLink", color: "#FF9900" },
  "net-tgw": { provider: "aws", service: "Transit-Gateway", color: "#FF9900" },
  "net-nacl": { provider: "aws", service: "NACL", color: "#FF9900" },
  "sec-sg": { provider: "aws", service: "Security-Group", color: "#DD344C" },
  "mc-aws-waf": { provider: "aws", service: "WAF", color: "#DD344C" },
  "db-redshift": { provider: "aws", service: "Redshift", color: "#3B48CC" },
};

const AZURE: Record<string, OfficialIconSpec> = {
  "mc-azure-apim": { provider: "azure", service: "API-Management", color: "#0078D4" },
  "mc-azure-functions": { provider: "azure", service: "Function-Apps", color: "#0078D4" },
  "mc-azure-eventhubs": { provider: "azure", service: "Event-Hubs", color: "#0078D4" },
};

const GCP: Record<string, OfficialIconSpec> = {
  "mc-gcp-gcs": { provider: "gcp", service: "Cloud-Storage", color: "#4285F4" },
  "mc-gcp-cloudrun": { provider: "gcp", service: "Cloud-Run", color: "#4285F4" },
  "mc-gcp-functions": { provider: "gcp", service: "Cloud-Functions", color: "#4285F4" },
  "mc-gcp-pubsub": { provider: "gcp", service: "Pub-Sub", color: "#4285F4" },
  "mc-gcp-cloudsql": { provider: "gcp", service: "Cloud-SQL", color: "#4285F4" },
  "mc-gcp-dns": { provider: "gcp", service: "Cloud-DNS", color: "#4285F4" },
  "mc-gcp-armor": { provider: "gcp", service: "Cloud-Armor", color: "#EA4335" },
  "mc-gcp-identity": { provider: "gcp", service: "Identity-Platform", color: "#EA4335" },
  "mc-gcp-secret": { provider: "gcp", service: "Secret-Manager", color: "#EA4335" },
};

const OFFICIAL_MAP: Record<string, OfficialIconSpec> = { ...AWS, ...AZURE, ...GCP };

/** Todos os catalogIds com ícone oficial — usado para validar integridade. */
export const OFFICIAL_ICON_IDS: string[] = Object.keys(OFFICIAL_MAP);

export function getOfficialIcon(catalogId: string): OfficialIconSpec | null {
  return OFFICIAL_MAP[catalogId] ?? null;
}

export function useOfficialIconMode(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem("archia-official-icons") !== "compact";
  } catch {
    return true;
  }
}

export function setOfficialIconMode(official: boolean): void {
  try {
    localStorage.setItem("archia-official-icons", official ? "official" : "compact");
  } catch {
    /* ignore */
  }
}
