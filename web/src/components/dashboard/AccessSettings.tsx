"use client";

import type { ProjectAccessEntry, ProjectAccessRole } from "@/lib/types";
import {
  Eye,
  Mail,
  Plus,
  Shield,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { useState } from "react";

type Props = {
  value: ProjectAccessEntry[];
  onChange: (next: ProjectAccessEntry[]) => void;
};

export default function AccessSettings({ value, onChange }: Props) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ProjectAccessRole>("read");

  function addEntry() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) return;
    if (value.some((e) => e.email === trimmed)) return;
    onChange([...value, { email: trimmed, role }]);
    setEmail("");
    setRole("read");
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <Users className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
        <div>
          <p className="text-xs font-medium text-slate-300">Acesso por e-mail</p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1 text-slate-400">
              <Eye className="h-3 w-3" /> Leitura
            </span>{" "}
            só visualiza ·{" "}
            <span className="inline-flex items-center gap-1 text-slate-400">
              <Shield className="h-3 w-3" /> Completo
            </span>{" "}
            edita e gerencia
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Mail className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addEntry();
              }
            }}
            placeholder="usuario@empresa.com"
            className="w-full rounded-lg border border-white/10 bg-black/30 py-2 pr-3 pl-8 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-[var(--accent)]"
          />
        </div>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as ProjectAccessRole)}
          className="rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-sm text-slate-200 outline-none"
          aria-label="Papel de acesso"
        >
          <option value="read">Leitura</option>
          <option value="full">Completo</option>
        </select>
        <button
          type="button"
          onClick={addEntry}
          className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10"
        >
          <UserPlus className="h-4 w-4" />
          Add
        </button>
      </div>

      {value.length > 0 && (
        <ul className="overflow-hidden rounded-lg border border-white/8 divide-y divide-white/5">
          {value.map((entry) => (
            <li
              key={entry.email}
              className="flex items-center justify-between gap-2 bg-white/[0.02] px-3 py-2 text-sm"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-700 text-[10px] font-bold text-slate-200">
                  {entry.email[0].toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-slate-200">{entry.email}</p>
                  <p className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                    {entry.role === "full" ? (
                      <>
                        <Shield className="h-3 w-3" /> Acesso completo
                      </>
                    ) : (
                      <>
                        <Eye className="h-3 w-3" /> Somente leitura
                      </>
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onChange(value.filter((e) => e.email !== entry.email))}
                className="rounded p-1.5 text-slate-500 hover:bg-rose-500/10 hover:text-rose-300"
                aria-label={`Remover ${entry.email}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {value.length === 0 && (
        <p className="inline-flex items-center gap-1.5 text-[11px] text-slate-600">
          <Plus className="h-3 w-3" />
          Nenhum colaborador adicionado ainda
        </p>
      )}
    </div>
  );
}
