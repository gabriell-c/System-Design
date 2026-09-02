"use client";

import Image from "next/image";
import { useAuthStore } from "@/lib/auth-store";
import { maskPhone } from "@/lib/masks";
import {
  AlertTriangle,
  BadgeCheck,
  CalendarDays,
  Camera,
  CheckCircle2,
  Crop,
  IdCard,
  Mail,
  Pencil,
  Phone,
  Save,
  Shield,
  Timer,
  User,
  UserCircle,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

type CropState = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export default function ProfilePage() {
  const { user, isLoading, fetchProfile, updateProfile, setAvatarUrl } = useAuthStore();
  const avatarUrl = user?.avatar_url ?? null;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ username: "", email: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [showCrop, setShowCrop] = useState(false);
  const [cropState, setCropState] = useState<CropState>({ x: 0, y: 0, width: 100, height: 100 });
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [cropping, setCropping] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-save settings
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [autoSaveInterval, setAutoSaveInterval] = useState(15);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  // Load avatar from localStorage on mount if not in store
  useEffect(() => {
    if (!avatarUrl) {
      try {
        const saved = localStorage.getItem("archia-user-avatar");
        if (saved) {
          setAvatarUrl(prev => prev || saved);
        }
      } catch {
        // ignore
      }
    }
  }, [avatarUrl]);

  async function save() {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const ok = await updateProfile({
        username: form.username,
        email: form.email,
        phone: form.phone || undefined,
        auto_save_enabled: autoSaveEnabled,
        auto_save_interval_minutes: autoSaveInterval,
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

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ["image/png", "image/jpeg", "image/webp", "image/avif", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      setError("Formato não suportado. Use PNG, JPEG, WebP, AVIF ou GIF.");
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError("Imagem muito grande. Máximo 10MB.");
      return;
    }

    const url = URL.createObjectURL(file);
    setCropImage(url);
    setShowCrop(true);
    // Reset crop to full image
    setCropState({ x: 0, y: 0, width: 100, height: 100 });
  }

  function applyCrop() {
    setCropping(true);
    // Create canvas to crop the image
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setCropping(false);
        return;
      }

      // Calculate how the image is displayed in the container (object-cover)
      const containerRatio = 1; // aspect-square
      const imgRatio = img.naturalWidth / img.naturalHeight;

      let sourceX = 0;
      let sourceY = 0;
      let sourceWidth = img.naturalWidth;
      let sourceHeight = img.naturalHeight;

      // When image is wider than container (landscape), we see only center portion
      if (imgRatio > containerRatio) {
        // Image is wider - visible height = full container height
        // Visible width = container height (because aspect-square)
        // The image is centered, so we see the middle portion
        sourceHeight = img.naturalHeight;
        sourceWidth = img.naturalHeight * containerRatio; // = img.naturalHeight (since ratio=1)
        sourceX = (img.naturalWidth - sourceWidth) / 2;
      } else if (imgRatio < containerRatio) {
        // Image is taller - visible width = full container width
        // Visible height = container width (because aspect-square)
        sourceWidth = img.naturalWidth;
        sourceHeight = img.naturalWidth / containerRatio; // = img.naturalWidth
        sourceY = (img.naturalHeight - sourceHeight) / 2;
      }

      // Convert crop percentages (relative to container) to image coordinates
      // The container shows sourceX..sourceX+sourceWidth of the image
      const cropX = sourceX + (sourceWidth * cropState.x) / 100;
      const cropY = sourceY + (sourceHeight * cropState.y) / 100;
      const cropW = (sourceWidth * cropState.width) / 100;
      const cropH = (sourceHeight * cropState.height) / 100;

      // Clamp to image bounds
      const safeX = Math.max(0, Math.min(cropX, img.naturalWidth - 1));
      const safeY = Math.max(0, Math.min(cropY, img.naturalHeight - 1));
      const safeW = Math.min(cropW, img.naturalWidth - safeX);
      const safeH = Math.min(cropH, img.naturalHeight - safeY);

      canvas.width = Math.max(1, Math.round(safeW));
      canvas.height = Math.max(1, Math.round(safeH));

      // Draw cropped image
      ctx.drawImage(
        img,
        safeX,
        safeY,
        safeW,
        safeH,
        0,
        0,
        canvas.width,
        canvas.height,
      );

      const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
      setAvatarUrl(dataUrl);
      setCropping(false);
      setShowCrop(false);
      if (cropImage) URL.revokeObjectURL(cropImage);
    };
    img.onerror = () => {
      setCropping(false);
    };
    img.src = cropImage;
  }

  function skipCrop() {
    setShowCrop(false);
    if (cropImage) URL.revokeObjectURL(cropImage);
  }

  function removeAvatar() {
    setAvatarUrl(null);
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
          {/* Profile card with avatar */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="relative group">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-indigo-500 text-xl font-bold text-slate-950 overflow-hidden">
                    {avatarUrl ? (
                      <Image
                        src={avatarUrl}
                        alt="Avatar"
                        width={64}
                        height={64}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      user.username[0].toUpperCase()
                    )}
                  </div>
                  <label
                    className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition group-hover:opacity-100 cursor-pointer"
                    title="Alterar foto"
                  >
                    <Camera className="h-5 w-5 text-white" />
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
                      className="hidden"
                      onChange={handleAvatarChange}
                    />
                  </label>
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={removeAvatar}
                      className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-white opacity-0 transition group-hover:opacity-100"
                      title="Remover foto"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
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
                  editing
                    ? "border-[var(--accent)]/30 bg-[var(--accent-muted)] text-indigo-200"
                    : "border-[var(--border)] text-[var(--muted-fg)] hover:border-slate-500 hover:text-slate-200"
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
                  <input
                    value={form.username}
                    onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]/40"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-[var(--muted-fg)]">E-mail</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]/40"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-[var(--muted-fg)]">Telefone</span>
                  <input
                    value={form.phone}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, "");
                      const masked = maskPhone(raw);
                      setForm((f) => ({ ...f, phone: masked }));
                    }}
                    placeholder="+55 (xx) xxxxx-xxxx"
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]/40"
                  />
                </label>

                {/* Auto-save settings */}
                <div className="rounded-lg border border-[var(--border)] bg-black/20 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-200">Salvamento automático</p>
                      <p className="text-xs text-[var(--muted)]">Salva seu progresso periodicamente</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAutoSaveEnabled(!autoSaveEnabled)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition ${
                        autoSaveEnabled ? "bg-[var(--accent)]" : "bg-[var(--surface-3)]"
                      }`}
                      aria-pressed={autoSaveEnabled}
                    >
                      <span
                        className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                          autoSaveEnabled ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                  {autoSaveEnabled && (
                    <div className="mt-3 flex items-center gap-2">
                      <label className="text-xs text-[var(--muted)]">Intervalo (minutos):</label>
                      <input
                        type="number"
                        min={1}
                        max={60}
                        value={autoSaveInterval}
                        onChange={(e) => setAutoSaveInterval(parseInt(e.target.value) || 1)}
                        className="w-20 rounded-md border border-[var(--border)] bg-black/30 px-2 py-1 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {error && <p className="text-xs text-rose-300">{error}</p>}
                  {success && <p className="text-xs text-emerald-300">Salvo com sucesso!</p>}
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => void save()}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-slate-950 hover:bg-[var(--accent-hover)] disabled:opacity-50"
                  >
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

      {/* Crop Modal */}
      {showCrop && cropImage && (
        <CropModal
          src={cropImage}
          cropState={cropState}
          setCropState={setCropState}
          onApply={() => {
            // Save the current crop state to localStorage
            try {
              localStorage.setItem("archia-crop-state", JSON.stringify(cropState));
            } catch {
              // ignore
            }
            applyCrop();
          }}
          onCancel={skipCrop}
          cropping={cropping}
        />
      )}
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

// ─── Crop Modal Component ─────────────────────────────────────────────────────
function CropModal({
  src,
  cropState,
  setCropState,
  onApply,
  onCancel,
  cropping,
}: {
  src: string;
  cropState: CropState;
  setCropState: React.Dispatch<React.SetStateAction<CropState>>;
  onApply: () => void;
  onCancel: () => void;
  cropping: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; state: CropState }>({ x: 0, y: 0, state: { x: 0, y: 0, width: 0, height: 0 } });
  const dragTypeRef = useRef<string | null>(null);

  function onMouseDown(e: React.MouseEvent, type: string) {
    e.preventDefault();
    e.stopPropagation();
    dragTypeRef.current = type;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      state: { ...cropState },
    };
    setIsDragging(true);
  }

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!isDragging) return;

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const dx = ((e.clientX - dragStartRef.current.x) / rect.width) * 100;
      const dy = ((e.clientY - dragStartRef.current.y) / rect.height) * 100;
      const base = dragStartRef.current.state;
      const type = dragTypeRef.current;

      if (type === "move") {
        const newX = Math.max(0, Math.min(100 - base.width, base.x + dx));
        const newY = Math.max(0, Math.min(100 - base.height, base.y + dy));
        setCropState({ ...base, x: newX, y: newY });
      } else if (type === "br") {
        // Bottom-right: only change size, keep top-left fixed
        const newW = Math.max(10, Math.min(100 - base.x, base.width + dx));
        const newH = Math.max(10, Math.min(100 - base.y, base.height + dy));
        setCropState({ ...base, width: newW, height: newH });
      } else if (type === "tl") {
        // Top-left: only change size, keep bottom-right fixed
        const newW = Math.max(10, base.width - dx);
        const newH = Math.max(10, base.height - dy);
        const newX = Math.max(0, base.x + dx);
        const newY = Math.max(0, base.y + dy);
        setCropState({ x: newX, y: newY, width: newW, height: newH });
      } else if (type === "tr") {
        // Top-right: only change size, keep bottom-left fixed
        const newW = Math.max(10, Math.min(100 - base.x, base.width + dx));
        const newH = Math.max(10, base.height - dy);
        const newY = Math.max(0, base.y + dy);
        setCropState({ ...base, y: newY, width: newW, height: newH });
      } else if (type === "bl") {
        // Bottom-left: only change size, keep top-right fixed
        const newW = Math.max(10, base.width - dx);
        const newH = Math.max(10, Math.min(100 - base.y, base.height + dy));
        const newX = Math.max(0, base.x + dx);
        setCropState({ ...base, x: newX, width: newW, height: newH });
      }
    }

    function onMouseUp() {
      setIsDragging(false);
      dragTypeRef.current = null;
    }

    if (isDragging) {
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isDragging, cropState, setCropState]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <Crop className="h-5 w-5 text-[var(--accent)]" />
            Ajustar foto de perfil
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-2 text-[var(--muted-fg)] hover:bg-white/5 hover:text-[var(--foreground)]"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Image container with crop overlay */}
        <div
          ref={containerRef}
          className="relative w-full aspect-square overflow-hidden rounded-lg bg-[var(--surface-3)] select-none"
        >
          <Image
            src={src}
            alt="Crop preview"
            width={500}
            height={500}
            className="h-full w-full object-cover"
          />
          {/* Dark overlay outside crop area */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Top */}
            <div
              className="absolute left-0 right-0 bg-black/60"
              style={{ top: 0, height: `${cropState.y}%` }}
            />
            {/* Bottom */}
            <div
              className="absolute left-0 right-0 bg-black/60"
              style={{ top: `${cropState.y + cropState.height}%`, height: `${100 - cropState.y - cropState.height}%` }}
            />
            {/* Left - only in crop vertical range */}
            <div
              className="absolute top-0 bottom-0 bg-black/60"
              style={{ left: 0, width: `${cropState.x}%` }}
            />
            {/* Right - only in crop vertical range */}
            <div
              className="absolute top-0 bottom-0 bg-black/60"
              style={{ right: 0, width: `${100 - cropState.x - cropState.width}%` }}
            />
          </div>
          {/* Crop area */}
          <div
            className="absolute border-2 border-[var(--accent)] shadow-lg cursor-move"
            style={{
              left: `${cropState.x}%`,
              top: `${cropState.y}%`,
              width: `${cropState.width}%`,
              height: `${cropState.height}%`,
            }}
            onMouseDown={(e) => onMouseDown(e, "move")}
          >
            {/* Grid lines (thirds) */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/30" />
              <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/30" />
              <div className="absolute top-1/3 left-0 right-0 h-px bg-white/30" />
              <div className="absolute top-2/3 left-0 right-0 h-px bg-white/30" />
            </div>
            {/* Corner handles */}
            <div
              className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-[var(--accent)] rounded-full cursor-nwse-resize"
              onMouseDown={(e) => { e.stopPropagation(); onMouseDown(e, "tl"); }}
            />
            <div
              className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-[var(--accent)] rounded-full cursor-nesw-resize"
              onMouseDown={(e) => { e.stopPropagation(); onMouseDown(e, "tr"); }}
            />
            <div
              className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-[var(--accent)] rounded-full cursor-nesw-resize"
              onMouseDown={(e) => { e.stopPropagation(); onMouseDown(e, "bl"); }}
            />
            <div
              className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-[var(--accent)] rounded-full cursor-nwse-resize"
              onMouseDown={(e) => { e.stopPropagation(); onMouseDown(e, "br"); }}
            />
          </div>
        </div>

        <p className="mt-3 text-xs text-[var(--muted)] text-center">
          Arraste o quadrado para posicionar • Arraste os cantos para ajustar o tamanho
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-3 py-2 text-sm text-[var(--muted-fg)] hover:bg-white/5"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onApply}
            disabled={cropping}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] disabled:opacity-50"
          >
            {cropping ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {cropping ? "Processando…" : "Aplicar"}
          </button>
        </div>
      </div>
    </div>
  );
}
