"use client";

import { AlertTriangle, RefreshCw, Shield, Trash2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { TeamAccess } from "@/lib/types";
import PanelEmpty from "@/components/ui/PanelEmpty";

interface Props {
  graphId: string;
}

type Role = "read" | "write" | "admin";

/** R9: regex do plano (após trim+toLowerCase; min 2 via checagem de tamanho). */
const TEAM_NAME_PATTERN = /^[a-z0-9][a-z0-9._-]{0,62}$/;
const TEAM_NAME_HINT =
  "Formato: 2 a 63 caracteres — letras minúsculas, números, ponto, _ ou - (inicia com letra ou número).";

/** Mensagem pt-BR quando o nome é inválido; `null` quando válido. */
function teamNameError(raw: string): string | null {
  const normalized = raw.trim().toLowerCase();
  if (normalized.length < 2) return "Mínimo de 2 caracteres.";
  if (!TEAM_NAME_PATTERN.test(normalized)) return TEAM_NAME_HINT;
  return null;
}

/**
 * R9 — ACL por squad. Correções:
 * - load com AbortController + estado `error` (banner + retry) +
 *   `loading` (esqueleto) — fim do `catch(() => undefined)` e do empty
 *   enganoso durante fetch (vazio só com `!loading && !error && lista vazia`);
 * - validação de team no front (regex do plano) com msg inline + disable;
 * - handleAdd/handleDelete com erro em banner (antes engolido).
 */
export default function AccessPanel({ graphId }: Props) {
  const [access, setAccess] = useState<TeamAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [team, setTeam] = useState("");
  const [role, setRole] = useState<Role>("read");
  const [saving, setSaving] = useState(false);
  const [tick, setTick] = useState(0);

  const teamError = teamNameError(team);
  const canAdd = !saving && team.trim() !== "" && teamError === null;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    api
      .listAccess(graphId, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setAccess(result);
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setError(e instanceof Error ? e.message : "Falha ao carregar");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      controller.abort();
    };
  }, [graphId, tick]);

  const handleAdd = async () => {
    if (!canAdd) return;
    setSaving(true);
    setActionError(null);
    try {
      const result = await api.setAccess(graphId, team.trim().toLowerCase(), role);
      setAccess((prev) => {
        const filtered = prev.filter((a) => a.team !== result.team);
        return [...filtered, { team: result.team, role: result.role as TeamAccess["role"] }];
      });
      setTeam("");
    } catch (e) {
      setActionError(`Falha ao adicionar acesso: ${e instanceof Error ? e.message : "erro desconhecido"}.`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (teamName: string) => {
    try {
      await api.deleteAccess(graphId, teamName);
      setAccess((prev) => prev.filter((a) => a.team !== teamName));
      setActionError(null);
    } catch (e) {
      setActionError(`Falha ao remover acesso: ${e instanceof Error ? e.message : "erro desconhecido"}.`);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 panel-section-title">
        <Shield size={12} className="text-amber-400" />
        Acesso por squad
      </div>
      <p className="panel-hint">Controle quais squads podem ver ou editar este diagrama.</p>

      {error && !loading && (
        <div className="space-y-2">
          <p
            role="alert"
            className="flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-950/30 px-3 py-2 text-sm text-rose-300"
          >
            <AlertTriangle size={14} />
            Falha ao carregar: {error}
          </p>
          <button
            type="button"
            className="btn-ghost inline-flex items-center gap-1.5"
            onClick={() => setTick((t) => t + 1)}
          >
            <RefreshCw size={14} />
            Tentar de novo
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-2" aria-label="Carregando acessos">
          <div className="h-12 animate-pulse rounded-lg border border-[var(--border)] bg-white/5" />
        </div>
      ) : (
        <div className="space-y-2">
          {access.map((a) => (
            <div key={a.team} className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-black/20 px-3 py-2">
              <div className="flex items-center gap-2">
                <Users size={11} className="text-[var(--muted-fg)]" />
                <span className="text-sm text-slate-200">{a.team}</span>
                <span
                  className={`rounded px-2 py-0.5 text-sm font-semibold ${
                    a.role === "admin"
                      ? "bg-violet-500/20 text-violet-200"
                      : a.role === "write"
                        ? "bg-[var(--accent-muted)] text-indigo-200"
                        : "bg-slate-500/20 text-slate-300"
                  }`}
                >
                  {a.role}
                </span>
              </div>
              <button
                type="button"
                className="text-[var(--muted)] hover:text-rose-400"
                onClick={() => void handleDelete(a.team)}
                title="Remover acesso"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
          {/* Vazio honesto: só sem loading/erro (fim do empty enganoso durante fetch). */}
          {access.length === 0 && (
            <PanelEmpty icon={Users} title="Nenhum squad ainda" description="O proprietário mantém acesso total. Adicione squads abaixo." />
          )}
        </div>
      )}

      {actionError && (
        <p role="alert" className="flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-950/30 px-3 py-2 text-sm text-rose-300">
          <AlertTriangle size={14} />
          {actionError}
        </p>
      )}

      <div className="space-y-2 rounded-lg border border-[var(--border)] bg-black/20 p-3">
        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]" htmlFor="access-team">
            Squad
          </label>
          <input
            id="access-team"
            className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--surface-1)] px-2 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] placeholder:text-[var(--muted-fg)]"
            placeholder="Nome do squad (ex: ads-team)"
            value={team}
            onChange={(e) => setTeam(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void handleAdd()}
          />
          {team.trim() !== "" && teamError ? (
            <p role="alert" className="mt-1 text-xs text-rose-400">
              {teamError}
            </p>
          ) : (
            <p className="mt-1 text-[11px] text-[var(--muted-fg)]">{TEAM_NAME_HINT}</p>
          )}
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="sr-only" htmlFor="access-role">
              Permissão
            </label>
            <select
              id="access-role"
              className="w-full rounded-md border border-[var(--border)] bg-[var(--surface-1)] px-2 py-2 text-sm text-slate-200"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
            >
              <option value="read">👁 Leitura</option>
              <option value="write">✏ Edição</option>
              <option value="admin">⚙ Admin</option>
            </select>
          </div>
          <button
            type="button"
            className="rounded-md bg-[var(--accent)]/80 px-3 py-2 text-sm text-white hover:bg-[var(--accent)] disabled:opacity-50"
            onClick={() => void handleAdd()}
            disabled={!canAdd}
          >
            {saving ? "Adicionando…" : "Adicionar"}
          </button>
        </div>
      </div>
    </div>
  );
}
