"use client";

import type { ProjectListFilters } from "@/lib/types";
import {
  Archive,
  ArrowDownAZ,
  ArrowUpDown,
  FolderOpen,
  Pin,
  Scale,
} from "lucide-react";
import CustomSelect from "@/components/ui/Select";

type Props = {
  filters: ProjectListFilters;
  onChange: (partial: Partial<ProjectListFilters>) => void;
};

export default function ProjectFilters({ filters, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <CustomSelect
        value={filters.sort_by ?? "recent"}
        options={[
          { value: "recent", label: "Recentes" },
          { value: "heaviest", label: "Mais pesados" },
          { value: "name", label: "Nome" },
        ]}
        onChange={(v) => onChange({ sort_by: v as ProjectListFilters["sort_by"] })}
        className="w-32"
      />

      <div className="inline-flex rounded-lg border border-[var(--border)] p-0.5 text-sm">
        <button
          type="button"
          onClick={() => onChange({ archived: false })}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 ${
            !filters.archived
              ? "bg-[var(--accent-muted)] text-indigo-200"
              : "text-[var(--muted-fg)] hover:text-slate-200"
          }`}
        >
          <FolderOpen className="h-3.5 w-3.5" />
          Ativos
        </button>
        <button
          type="button"
          onClick={() => onChange({ archived: true })}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 ${
            filters.archived
              ? "bg-[var(--accent-muted)] text-indigo-200"
              : "text-[var(--muted-fg)] hover:text-slate-200"
          }`}
        >
          <Archive className="h-3.5 w-3.5" />
          Arquivados
        </button>
      </div>

      <label className="ml-1 inline-flex cursor-pointer items-center gap-2 text-sm text-[var(--muted-fg)]">
        <input
          type="checkbox"
          checked={filters.pinned_first ?? true}
          onChange={(e) => onChange({ pinned_first: e.target.checked })}
          className="rounded border-[var(--border-strong)] bg-black/40 text-[var(--accent)] focus:ring-[var(--ring)]"
        />
        <Pin className="h-3.5 w-3.5" />
        Fixados primeiro
      </label>

      <span className="hidden items-center gap-2 text-sm text-[var(--muted-fg)] sm:inline-flex" title="Dica de ordenação">
        {filters.sort_by === "name" ? (
          <ArrowDownAZ className="h-3 w-3" />
        ) : filters.sort_by === "heaviest" ? (
          <Scale className="h-3 w-3" />
        ) : null}
      </span>
    </div>
  );
}
