"use client";

import { Shield, Trash2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { TeamAccess } from "@/lib/types";

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
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        <Shield size={12} className="text-amber-400" />
        Acesso por squad
      </div>
      <p className="text-[10px] text-slate-500">
        Controle quais squads podem ver ou editar este diagrama.
      </p>

      <div className="space-y-2">
        {access.map((a) => (
          <div key={a.team} className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2">
            <div className="flex items-center gap-2">
              <Users size={11} className="text-slate-400" />
              <span className="text-[11px] text-slate-200">{a.team}</span>
              <span
                className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${
                  a.role === "admin" ? "bg-violet-500/20 text-violet-200" :
                  a.role === "write" ? "bg-cyan-500/20 text-cyan-200" :
                  "bg-slate-500/20 text-slate-300"
                }`}
              >
                {a.role}
              </span>
            </div>
            <button
              type="button"
              className="text-slate-500 hover:text-rose-400"
              onClick={() => handleDelete(a.team)}
              title="Remover acesso"
            >
              <Trash2 size={11} />
            </button>
          </div>
        ))}
        {access.length === 0 && (
          <p className="text-[10px] text-slate-600">Nenhum squad configurado. O proprietário original mantém acesso total.</p>
        )}
      </div>

      <div className="rounded-lg border border-white/10 bg-black/20 p-3 space-y-2">
        <input
          className="w-full rounded-md border border-white/10 bg-[#0d1219] px-2 py-1.5 text-[11px] text-slate-100 outline-none placeholder:text-slate-600"
          placeholder="Nome do squad (ex: ads-team)"
          value={team}
          onChange={(e) => setTeam(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <div className="flex gap-1">
          <select
            className="flex-1 rounded-md border border-white/10 bg-[#0d1219] px-2 py-1.5 text-[11px] text-slate-200"
            value={role}
            onChange={(e) => setRole(e.target.value as "read" | "write" | "admin")}
          >
            <option value="read">👁 Leitura</option>
            <option value="write">✏ Edição</option>
            <option value="admin">⚙ Admin</option>
          </select>
          <button
            type="button"
            className="rounded-md bg-cyan-600/80 px-3 py-1.5 text-[11px] text-white hover:bg-cyan-500 disabled:opacity-50"
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
