"use client";

import { useAuthStore } from "@/lib/auth-store";
import {
  AlertTriangle,
  BadgeCheck,
  CalendarDays,
  IdCard,
  Mail,
  Pencil,
  Phone,
  Save,
  Shield,
  Timer,
  User,
  UserCircle,
} from "lucide-react";
import { useEffect, useState } from "react";

export default function ProfilePage() {
  const { user, isLoading, fetchProfile, updateProfile } = useAuthStore();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ username: "", email: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({ username: user.username, email: user.email, phone: user.phone ?? "" });
    }
  }, [user]);

  async function save() {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const ok = await updateProfile({
        username: form.username,
        email: form.email,
        phone: form.phone || undefined,
      });
      if (ok) {
        setSuccess(true);
        setEditing(false);
        setTimeout(() => setSuccess(false), 2000);
      } else {
        setError("Falha ao salvar perfil");
      }
    } catch {
      setError("Falha ao conectar ao servidor");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading || !user) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--accent)]/30 border-t-[var(--accent)]" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--background)] px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent-muted)] text-[var(--accent)]">
            <UserCircle className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-base font-semibold tracking-tight text-slate-100">Meu perfil</h1>
            <p className="mt-0.5 text-xs text-[var(--muted)]">Gerencie suas informações pessoais</p>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto w-full max-w-2xl space-y-4">
          {/* Profile card */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-indigo-500 text-xl font-bold text-slate-950">
                  {user.username[0].toUpperCase()}
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-100">{user.username}</h2>
                  <p className="text-sm text-[var(--muted)]">{user.email}</p>
                  <p className="mt-1 text-xs text-[var(--muted-fg)]">
                    Entrou em {new Date(user.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditing((v) => !v);
                  setError(null);
                  setSuccess(false);
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                  editing ? "border-[var(--accent)]/30 bg-[var(--accent-muted)] text-indigo-200" : "border-[var(--border)] text-[var(--muted-fg)] hover:border-slate-500 hover:text-slate-200"
                }`}
              >
                <Pencil className="h-3.5 w-3.5" />
                {editing ? "Cancelar" : "Editar"}
              </button>
            </div>

            {editing && (
              <div className="mt-5 space-y-3">
                <label className="block">
                  <span className="text-xs text-[var(--muted-fg)]">Nome de usuário</span>
                  <input value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]/40" />
                </label>
                <label className="block">
                  <span className="text-xs text-[var(--muted-fg)]">E-mail</span>
                  <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]/40" />
                </label>
                <label className="block">
                  <span className="text-xs text-[var(--muted-fg)]">Telefone</span>
                  <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="+55 (xx) xxxxx-xxxx"
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]/40" />
                </label>
                <div className="flex items-center gap-3">
                  {error && <p className="text-xs text-rose-300">{error}</p>}
                  {success && <p className="text-xs text-emerald-300">Salvo com sucesso!</p>}
                </div>
                <div className="flex justify-end">
                  <button type="button" onClick={() => void save()} disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-slate-950 hover:bg-[var(--accent-hover)] disabled:opacity-50">
                    <Save className="h-3.5 w-3.5" />
                    {saving ? "Salvando…" : "Salvar alterações"}
                  </button>
                </div>
              </div>
            )}

            {!editing && (
              <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <Field icon={<User className="h-4 w-4 text-[var(--muted)]" />} label="Usuário" value={user.username} />
                <Field icon={<Mail className="h-4 w-4 text-[var(--muted)]" />} label="E-mail" value={user.email} />
                <Field icon={<CalendarDays className="h-4 w-4 text-[var(--muted)]" />} label="Membro desde" value={new Date(user.created_at).toLocaleDateString("pt-BR")} />
                <Field icon={<Phone className="h-4 w-4 text-[var(--muted)]" />} label="Telefone" value={user.phone ?? "—"} />
              </dl>
            )}
          </div>

          {/* Account info */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-5">
            <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-200">
              <IdCard className="h-4 w-4 text-[var(--accent)]" />
              Informações da conta
            </h3>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <Field icon={<BadgeCheck className="h-4 w-4 text-[var(--muted)]" />} label="ID do usuário" value={String(user.id)} />
              <Field icon={<Shield className="h-4 w-4 text-[var(--muted)]" />} label="Cargo" value={user.role ?? "—"} />
              <Field icon={<Save className="h-4 w-4 text-[var(--muted)]" />} label="Salvamento automático" value={user.auto_save_enabled ? "Ativado" : "Desativado"} />
              <Field icon={<Timer className="h-4 w-4 text-[var(--muted)]" />} label="Intervalo de auto-save" value={`${user.auto_save_interval_minutes ?? 15} min`} />
            </dl>
          </div>

          {/* Danger zone */}
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-5">
            <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-rose-300">
              <AlertTriangle className="h-4 w-4" />
              Zona de perigo
            </h3>
            <p className="mt-1 text-xs text-rose-400/70">
              Excluir sua conta remove permanentemente todos os dados e projetos.
            </p>
            <p className="mt-3 text-xs text-[var(--muted)]">Contate o suporte para exclusão.</p>
          </div>
        </div>
      </main>
    </div>
  );
}

function Field({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      {icon && <span className="mt-0.5">{icon}</span>}
      <div>
        <dt className="text-xs text-[var(--muted)]">{label}</dt>
        <dd className="mt-0.5 font-medium text-slate-200">{value}</dd>
      </div>
    </div>
  );
}
