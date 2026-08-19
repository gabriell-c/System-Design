import type { Edge, Node } from "@xyflow/react";
import { isArchData, isBlockData, isZoneData, type CanvasNodeData } from "./types";

/** P1.5.4 — C4-PlantUML export (Context/Container level). */
export function exportToC4Plantuml(
  nodes: Node<CanvasNodeData>[],
  edges: Edge[],
  title = "Architecture",
): string {
  const lines: string[] = [
    "@startuml",
    "!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Container.puml",
    "",
    `title ${title}`,
    "",
    "Person(user, \"User\", \"End user\")",
    "",
  ];

  const systems = nodes.filter((n) => isArchData(n.data) && n.data.kind === "frontend");
  const containers = nodes.filter(
    (n) => isArchData(n.data) && ["backend", "database", "integration"].includes(n.data.kind),
  );
  const zones = nodes.filter((n) => isZoneData(n.data));

  for (const z of zones) {
    if (!isZoneData(z.data)) continue;
    lines.push(`Boundary(${sanitize(z.id)}, "${escape(z.data.label)}", "${z.data.zoneKind}") {`);
  }

  for (const s of systems) {
    if (!isArchData(s.data)) continue;
    lines.push(`  System(${sanitize(s.id)}, "${escape(s.data.label)}", "${escape(s.data.tech)}")`);
  }

  for (const c of containers) {
    if (!isArchData(c.data)) continue;
    const kind = c.data.kind === "database" ? "ContainerDb" : "Container";
    lines.push(
      `  ${kind}(${sanitize(c.id)}, "${escape(c.data.label)}", "${escape(c.data.tech)}", "${c.data.kind}")`,
    );
  }

  for (const z of zones) {
    lines.push("}");
  }

  lines.push("");
  for (const e of edges) {
    const label = (e.data as { label?: string })?.label ?? "";
    lines.push(`Rel(${sanitize(e.source)}, ${sanitize(e.target)}, "${escape(label)}")`);
  }

  lines.push("", "@enduml");
  return lines.join("\n");
}

function sanitize(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, "_");
}

function escape(s: string): string {
  return s.replace(/"/g, '\\"');
}
