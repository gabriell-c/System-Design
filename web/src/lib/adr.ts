import type { Node } from "@xyflow/react";
import { isArchData, type AdrEntry, type CanvasNodeData, type ProjectNfr } from "./types";
import { KIND_META } from "./catalog";
import { nfrSummary } from "./nfr";

function archNodes(nodes: Node<CanvasNodeData>[]) {
  return nodes.filter((n) => isArchData(n.data));
}

/** Gera ADRs leves a partir das escolhas já no canvas (+ NFR). */
export function buildAdrs(
  nodes: Node<CanvasNodeData>[],
  nfr: ProjectNfr,
  context: string,
): AdrEntry[] {
  const cards = archNodes(nodes);
  const byKind = new Map<string, typeof cards>();
  for (const n of cards) {
    if (!isArchData(n.data)) continue;
    const list = byKind.get(n.data.kind) ?? [];
    list.push(n);
    byKind.set(n.data.kind, list);
  }

  const adrs: AdrEntry[] = [];
  let seq = 1;

  const push = (title: string, decision: string, consequences: string[], ctxExtra = "") => {
    adrs.push({
      id: `ADR-${String(seq).padStart(3, "0")}`,
      title,
      status: "proposto",
      context: [context.trim().slice(0, 280), ctxExtra, nfrSummary(nfr)].filter(Boolean).join(" · "),
      decision,
      consequences,
    });
    seq += 1;
  };

  for (const kind of ["backend", "frontend", "database", "identity", "observability", "cloud", "integration"] as const) {
    const list = byKind.get(kind);
    if (!list?.length) continue;
    const labels = list.map((n) => (isArchData(n.data) ? n.data.label : n.id)).join(", ");
    const meta = KIND_META[kind];
    push(
      `Escolha de ${meta.label}`,
      labels,
      [
        `Componentes de ${meta.label.toLowerCase()} ficam explícitos no diagrama.`,
        "Reavaliar se o time/orçamento não sustentarem a complexidade.",
      ],
      `${list.length} card(s)`,
    );
  }

  if (nfr.compliance.length) {
    push(
      "Restrições de compliance",
      nfr.compliance.join(", "),
      [
        "Decisões de auth, logs e retenção devem respeitar esses frameworks.",
        "Documentar bases legais e DPA com fornecedores.",
      ],
    );
  }

  if (nfr.environments.has_prod) {
    const path = [
      nfr.environments.has_dev ? "dev" : null,
      nfr.environments.has_staging ? "staging" : null,
      "prod",
      nfr.environments.has_ci_cd ? "CI/CD" : "deploy manual",
      nfr.environments.has_backups ? "backups" : "sem backup marcado",
    ]
      .filter(Boolean)
      .join(" → ");
    push("Caminho até produção", path, [
      "Promoção entre ambientes precisa de checklist (migração, feature flag, rollback).",
      nfr.environments.has_monitoring_plan
        ? "Monitoramento previsto antes do go-live."
        : "Definir alertas antes de abrir tráfego real.",
    ]);
  }

  if (adrs.length === 0) {
    push(
      "Arquitetura ainda em branco",
      "Nenhuma tecnologia escolhida",
      ["Use um template ou a paleta para registrar a primeira decisão."],
    );
  }

  return adrs;
}
