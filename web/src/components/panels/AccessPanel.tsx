"use client";

import { Shield, Trash2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { TeamAccess } from "@/lib/types";
import PanelEmpty from "@/components/ui/PanelEmpty";

interface Props {
  graphId: string;
}

export default function AccessPanel({ graphId }: Props) {
  const [access, setAccess] = useState<TeamAccess[]>([]);
  const [team, setTeam] = useState("");
  const [role, setRole] = useState<"read" | "write" | "admin">("read");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void api.listAccess(graphId).then(setAccess).catch(() => undefined);
  }, [graphId]);

  const handleAdd = async () => {
    if (!team.trim()) return;
    setLoading(true);
    try {
      const result = await api.setAccess(graphId, team.trim().toLowerCase(), role);
      setAccess((prev) => {
        const filtered = prev.filter((a) => a.team !== result.team);
        return [...filtered, { team: result.team, role: result.role as TeamAccess["role"] }];
      });
      setTeam("");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (teamName: string) => {
    await api.deleteAccess(graphId, teamName);
    setAccess((prev) => prev.filter((a) => a.team !== teamName));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 panel-section-title">
        <Shield size={12} className="text-amber-400" />
        Acesso por squad
      </div>
      <p className="panel-hint">
        Controle quais squads podem ver ou editar este diagrama.
      </p>

      <div className="space-y-2">
        {access.map((a) => (
          <div key={a.team} className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-black/20 px-3 py-2">
            <div className="flex items-center gap-2">
              <Users size={11} className="text-[var(--muted-fg)]" />
              <span className="text-sm text-slate-200">{a.team}</span>
              <span
                className={`rounded px-2 py-0.5 text-sm font-semibold ${
                  a.role === "admin" ? "bg-violet-500/20 text-violet-200" :
                  a.role === "write" ? "bg-[var(--accent-muted)] text-indigo-200" :
                  "bg-slate-500/20 text-slate-300"
                }`}
              >
                {a.role}
              </span>
            </div>
            <button
              type="button"
              className="text-[var(--muted)] hover:text-rose-400"
              onClick={() => handleDelete(a.team)}
              title="Remover acesso"
            >
              <Trash2 size={11} />
            </button>
          </div>
        ))}
        {access.length === 0 && (
          <PanelEmpty
            icon={Users}
            title="Nenhum squad ainda"
            description="O proprietário mantém acesso total. Adicione squads abaixo."
          />
        )}
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-black/20 p-3 space-y-2">
        <input
          className="w-full rounded-md border border-[var(--border)] bg-[var(--surface-1)] px-2 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] placeholder:text-[var(--muted-fg)]"
          placeholder="Nome do squad (ex: ads-team)"
          value={team}
          onChange={(e) => setTeam(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <div className="flex gap-2">
          <select
            className="flex-1 rounded-md border border-[var(--border)] bg-[var(--surface-1)] px-2 py-2 text-sm text-slate-200"
            value={role}
            onChange={(e) => setRole(e.target.value as "read" | "write" | "admin")}
          >
            <option value="read">👁 Leitura</option>
            <option value="write">✏ Edição</option>
            <option value="admin">⚙ Admin</option>
          </select>
          <button
            type="button"
            className="rounded-md bg-[var(--accent)]/80 px-3 py-2 text-sm text-white hover:bg-[var(--accent)] disabled:opacity-50"
            onClick={handleAdd}
            disabled={loading || !team.trim()}
          >
            Adicionar
          </button>
        </div>
      </div>
    </div>
  );
}
