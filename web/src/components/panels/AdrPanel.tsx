"use client";

import { useMemo, useState } from "react";
import { BookMarked, Copy, ExternalLink } from "lucide-react";
import { buildAdrs } from "@/lib/adr";
import { useGraphStore } from "@/lib/graph-store";
import type { AdrEntry } from "@/lib/types";

const LINKS_KEY = "archia-adr-links";

function loadLinks(): Record<string, { jira_key?: string; confluence_url?: string }> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(LINKS_KEY) ?? "{}") as Record<
      string,
      { jira_key?: string; confluence_url?: string }
    >;
  } catch {
    return {};
  }
}

export default function AdrPanel() {
  const nodes = useGraphStore((s) => s.nodes);
  const nfr = useGraphStore((s) => s.nfr);
  const context = useGraphStore((s) => s.context);
  const pushUiNotice = useGraphStore((s) => s.pushUiNotice);
  const [links, setLinks] = useState(loadLinks);

  const adrs = useMemo(
    () =>
      buildAdrs(nodes, nfr, context).map((a) => ({
        ...a,
        jira_key: links[a.id]?.jira_key,
        confluence_url: links[a.id]?.confluence_url,
      })),
    [nodes, nfr, context, links],
  );

  function saveLink(id: string, patch: { jira_key?: string; confluence_url?: string }) {
    const next = { ...links, [id]: { ...links[id], ...patch } };
    setLinks(next);
    localStorage.setItem(LINKS_KEY, JSON.stringify(next));
  }

  function copyAll() {
    const md = adrs
      .map(
        (a) =>
          `## ${a.id}: ${a.title}\n\nStatus: ${a.status}\n${a.jira_key ? `Jira: ${a.jira_key}\n` : ""}${a.confluence_url ? `Confluence: ${a.confluence_url}\n` : ""}\n### Contexto\n${a.context}\n\n### Decisão\n${a.decision}\n\n### Consequências\n${a.consequences.map((c) => `- ${c}`).join("\n")}\n`,
      )
      .join("\n");
    void navigator.clipboard.writeText(md).then(() => {
      pushUiNotice({ type: "success", text: "ADRs copiados em Markdown." });
    });
  }

  return (
    <div className="space-y-4 px-4 py-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-300">
            <BookMarked size={16} />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-100">ADRs leves</p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
              Decisões inferidas do canvas — vincule Jira/Confluence (P1.4.6).
            </p>
          </div>
        </div>
        <button type="button" className="btn-ghost inline-flex items-center gap-1 text-[11px]" onClick={copyAll}>
          <Copy size={12} />
          Copiar
        </button>
      </div>

      <ul className="space-y-3">
        {adrs.map((adr) => (
          <li key={adr.id} className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              {adr.id} · {adr.status}
            </p>
            <p className="mt-1 text-sm font-medium text-slate-100">{adr.title}</p>
            <div className="mt-2 grid gap-2">
              <input
                className="rounded border border-white/10 bg-[#0d1219] px-2 py-1 text-[11px] text-slate-100"
                placeholder="Jira key (LDEV-123)"
                value={adr.jira_key ?? ""}
                onChange={(e) => saveLink(adr.id, { jira_key: e.target.value })}
              />
              <input
                className="rounded border border-white/10 bg-[#0d1219] px-2 py-1 text-[11px] text-slate-100"
                placeholder="Confluence URL"
                value={adr.confluence_url ?? ""}
                onChange={(e) => saveLink(adr.id, { confluence_url: e.target.value })}
              />
            </div>
            {(adr.jira_key || adr.confluence_url) && (
              <div className="mt-2 flex gap-2 text-[11px]">
                {adr.jira_key && (
                  <a
                    href={`https://ligiaacademy.atlassian.net/browse/${adr.jira_key}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-cyan-300"
                  >
                    <ExternalLink size={10} /> {adr.jira_key}
                  </a>
                )}
                {adr.confluence_url && (
                  <a href={adr.confluence_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-violet-300">
                    <ExternalLink size={10} /> Confluence
                  </a>
                )}
              </div>
            )}
            <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
              <span className="text-slate-500">Decisão: </span>
              {adr.decision}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
