"use client";

import type { Project } from "@/lib/types";
import {
  Archive,
  Calendar,
  FileStack,
  Globe2,
  Lock,
  MoreHorizontal,
  Network,
  Pencil,
  Pin,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Props = {
  project: Project;
  onPin: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onEdit?: () => void;
};

export default function ProjectCard({
  project,
  onPin,
  onArchive,
  onDelete,
  onEdit,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    if (menuOpen) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const updated = project.updated_at
    ? new Date(project.updated_at).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

  return (
    <div className="group relative flex flex-col rounded-xl border border-white/8 bg-[var(--surface-2)] p-4 transition hover:border-[var(--accent)]/30 hover:bg-[var(--surface-3)]">
      <div className="mb-3 flex items-start justify-between gap-2">
        <Link href={`/project/${project.id}`} className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-muted)] text-[var(--accent)]">
              <FileStack className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                {project.pinned && (
                  <Pin className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" aria-label="Fixado" />
                )}
                <h3 className="truncate text-base font-semibold text-slate-100 group-hover:text-indigo-200">
                  {project.name}
                </h3>
              </div>
              <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">
                {project.description?.trim() || "Sem descrição"}
              </p>
            </div>
          </div>
        </Link>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-lg p-1.5 text-slate-500 opacity-0 transition hover:bg-white/5 hover:text-slate-200 group-hover:opacity-100"
            aria-label="Ações do projeto"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border border-white/10 bg-[var(--surface-1)] py-1 shadow-xl">
              {onEdit && (
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-300 hover:bg-white/5"
                  onClick={() => {
                    setMenuOpen(false);
                    onEdit();
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Editar
                </button>
              )}
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-300 hover:bg-white/5"
                onClick={() => {
                  setMenuOpen(false);
                  onPin();
                }}
              >
                <Pin className="h-3.5 w-3.5" />
                {project.pinned ? "Desafixar" : "Fixar"}
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-300 hover:bg-white/5"
                onClick={() => {
                  setMenuOpen(false);
                  onArchive();
                }}
              >
                <Archive className="h-3.5 w-3.5" />
                {project.archived ? "Restaurar" : "Arquivar"}
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rose-300 hover:bg-rose-500/10"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Excluir
              </button>
            </div>
          )}
        </div>
      </div>

      <Link href={`/project/${project.id}`} className="mt-auto flex items-center justify-between gap-2 pt-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${
            project.is_public
              ? "bg-emerald-500/10 text-emerald-300"
              : "bg-slate-500/10 text-slate-400"
          }`}
        >
          {project.is_public ? (
            <>
              <Globe2 className="h-3 w-3" /> Público
            </>
          ) : (
            <>
              <Lock className="h-3 w-3" /> Privado
            </>
          )}
        </span>
        <span className="inline-flex items-center gap-2 text-[11px] text-slate-600">
          <span className="inline-flex items-center gap-1">
            <Network className="h-3 w-3" />
            {project.node_count ?? 0}
          </span>
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {updated}
          </span>
        </span>
      </Link>
    </div>
  );
}
