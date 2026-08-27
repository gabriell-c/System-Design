"use client";

import { ChevronRight } from "lucide-react";
import { useMemo } from "react";
import { useGraphStore } from "@/lib/graph-store";
import { useProjectStore } from "@/lib/project-store";
import { isFreeData, isZoneData } from "@/lib/types";
import { ZONE_META } from "@/lib/zones";

/**
 * Breadcrumbs for the active canvas context (project → mode → zone/swimlane → selection).
 */
export default function CanvasBreadcrumbs() {
  const name = useGraphStore((s) => s.name);
  const nodes = useGraphStore((s) => s.nodes);
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const focusedZoneId = useGraphStore((s) => s.focusedZoneId);
  const architectureView = useGraphStore((s) => s.architectureView);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const projects = useProjectStore((s) => s.projects);
  const project = projects.find((p) => p.id === activeProjectId);
  const isFree = project?.project_kind === "free";

  const crumbs = useMemo(() => {
    const items: { key: string; label: string }[] = [
      { key: "project", label: project?.name?.trim() || "Projeto" },
      { key: "mode", label: isFree ? "Diagrama livre" : "Arquitetura" },
    ];

    if (!isFree && architectureView) {
      items.push({ key: "view", label: architectureView.toUpperCase() });
    }

    const zoneId = focusedZoneId;
    if (zoneId) {
      const zone = nodes.find((n) => n.id === zoneId);
      if (zone && isZoneData(zone.data)) {
        items.push({
          key: "zone",
          label: ZONE_META[zone.data.zoneKind]?.label ?? zone.data.label ?? "Zona",
        });
      }
    }

    if (selectedNodeId) {
      const sel = nodes.find((n) => n.id === selectedNodeId);
      if (sel) {
        const label = isFreeData(sel.data)
          ? sel.data.label
          : "label" in sel.data
            ? String(sel.data.label)
            : sel.id.slice(0, 8);
        items.push({ key: "sel", label: label || "Seleção" });
      }
    } else if (name?.trim()) {
      items.push({ key: "diagram", label: name.trim() });
    }

    return items;
  }, [architectureView, focusedZoneId, isFree, name, nodes, project?.name, selectedNodeId]);

  return (
    <nav
      className="pointer-events-none absolute left-3 top-3 z-20 max-w-[min(100%,28rem)]"
      aria-label="Contexto do canvas"
    >
      <ol className="pointer-events-auto flex flex-wrap items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-1)]/90 px-2.5 py-1.5 text-xs text-[var(--muted)] backdrop-blur elev-2">
        {crumbs.map((c, i) => (
          <li key={c.key} className="flex items-center gap-1 min-w-0">
            {i > 0 && <ChevronRight size={12} className="shrink-0 text-[var(--muted-fg)]" aria-hidden />}
            <span
              className={`truncate ${i === crumbs.length - 1 ? "font-medium text-[var(--foreground)]" : ""}`}
              title={c.label}
            >
              {c.label}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
