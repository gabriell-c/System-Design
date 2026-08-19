"use client";

import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { analyzeDiagramConsistency, type ConsistencyIssue } from "@/lib/diagram-consistency";
import { diagramKindLabel } from "@/lib/diagram-library";
import { useProjectStore } from "@/lib/project-store";

/** P0.1.6 — Painel de inconsistências cross-diagram. */
export default function ConsistencyPanel() {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const projects = useProjectStore((s) => s.projects);
  const [issues, setIssues] = useState<ConsistencyIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [remoteOk, setRemoteOk] = useState<boolean | null>(null);

  const project = projects.find((p) => p.id === activeProjectId);

  const refresh = useCallback(async () => {
    if (!activeProjectId || !project?.diagrams?.length) {
      setIssues([]);
      setRemoteOk(null);
      return;
    }
    setLoading(true);
    try {
      const remote = await api.projectConsistency(activeProjectId);
      setRemoteOk(Boolean(remote.ok));
      if (Array.isArray(remote.issues) && remote.issues.length) {
        setIssues(
          remote.issues.map((i: Record<string, unknown>) => ({
            severity: (i.severity as ConsistencyIssue["severity"]) ?? "warning",
            stableRef: String(i.stable_ref ?? ""),
            label: String(i.label ?? ""),
            presentIn: (i.present_in as string[]) ?? [],
            missingIn: (i.missing_in as string[]) ?? [],
            detail: String(i.detail ?? ""),
          })),
        );
      } else {
        const local = analyzeDiagramConsistency(
          project.diagrams.map((d) => ({
            graphId: d.id,
            kind: d.diagram_kind ?? null,
            name: d.name,
            nodes: (d.nodes ?? []) as Array<{ id: string; data?: { label?: string; catalogId?: string; stableRef?: string } }>,
          })),
        );
        setIssues(local);
      }
    } catch {
      const local = analyzeDiagramConsistency(
        (project?.diagrams ?? []).map((d) => ({
          graphId: d.id,
          kind: d.diagram_kind ?? null,
          name: d.name,
          nodes: (d.nodes ?? []) as Array<{ id: string; data?: { label?: string; catalogId?: string; stableRef?: string } }>,
        })),
      );
      setIssues(local);
      setRemoteOk(null);
    } finally {
      setLoading(false);
    }
  }, [activeProjectId, project]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="space-y-4 px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-100">Consistência do pacote</p>
          <p className="text-xs text-slate-400">Serviços presentes em todas as vistas tipadas.</p>
        </div>
        <button type="button" className="btn-ghost p-1.5" onClick={() => void refresh()} aria-label="Atualizar">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {remoteOk === true && issues.length === 0 && (
        <p className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          <CheckCircle2 size={14} /> Pacote consistente entre {project?.diagrams?.length ?? 0} diagramas.
        </p>
      )}

      {issues.length === 0 && !loading ? (
        <p className="text-xs text-slate-500">Nenhuma inconsistência detectada (mín. 2 diagramas no projeto).</p>
      ) : (
        <ul className="space-y-2">
          {issues.map((issue) => (
            <li
              key={issue.stableRef}
              className={`rounded-lg border px-3 py-2 text-xs ${
                issue.severity === "critical"
                  ? "border-rose-500/40 bg-rose-500/10 text-rose-100"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-100"
              }`}
            >
              <p className="flex items-center gap-1.5 font-medium">
                <AlertTriangle size={12} />
                {issue.label}
              </p>
              <p className="mt-1 text-slate-400">{issue.detail}</p>
              <p className="mt-1 text-[10px] text-slate-500">
                Em: {issue.presentIn.join(", ") || "—"} · Falta: {issue.missingIn.join(", ") || "—"}
              </p>
            </li>
          ))}
        </ul>
      )}

      {project?.diagrams?.length ? (
        <div className="rounded-lg border border-white/10 bg-black/20 p-2">
          <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">Vistas</p>
          <ul className="space-y-0.5">
            {project.diagrams.map((d) => (
              <li key={d.id} className="text-[11px] text-slate-300">
                {diagramKindLabel(d.diagram_kind)} · {d.name}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
