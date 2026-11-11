"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, KeyRound, Phone, CheckCircle } from "lucide-react";
import { maskPhone } from "@/lib/masks";
import { useTranslation } from "@/i18n";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4410";

/** Fluxo em 2 passos (P1.3): /recover é enumeration-safe (sempre {sent: true})
 *  e entrega um código de 8 dígitos fora da resposta; /recover/confirm valida
 *  o código e invalida todas as sessões do usuário. */
type Step = "verify" | "code";

export default function RecoverPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [step, setStep] = useState<Step>("verify");
  const [form, setForm] = useState({ phone: "", birth_date: "" });
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (k: "phone" | "birth_date", v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccess(""); setLoading(true);
    try {
      const r = await fetch(`${API}/api/v1/auth/recover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: form.phone, birth_date: form.birth_date }),
      });
      // A resposta nunca revela se o usuário existe ({sent: true} sempre).
      if (!r.ok) { setError(t("recover.verification_failed")); return; }
      setStep("code");
    } catch { setError(t("recover.network_error")); } finally { setLoading(false); }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{8}$/.test(code)) { setError(t("recover.code_invalid")); return; }
    setError(""); setLoading(true);
    try {
      const r = await fetch(`${API}/api/v1/auth/recover/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: form.phone,
          birth_date: form.birth_date,
          code,
          new_password: newPassword,
        }),
      });
      if (!r.ok) { setError(t("recover.confirm_failed")); return; }
      setSuccess(t("recover.password_reset_redirect"));
      setTimeout(() => router.push("/login"), 2000);
    } catch { setError(t("recover.network_error")); } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] p-4">
      <div className="w-full max-w-md">
        <Link href="/login" className="inline-flex items-center gap-2 text-[var(--muted-fg)] hover:text-white mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> {t("recover.back_to_login")}
        </Link>
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center"><KeyRound className="w-5 h-5 text-amber-400" /></div>
            <div><h2 className="text-xl font-semibold text-white">{t("recover.password_recovery")}</h2>
              <p className="text-sm text-[var(--muted-fg)]">{step === "verify" ? t("recover.verify_identity") : t("recover.set_new_password")}</p></div>
          </div>
          {error && <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}
          {success && <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">{success}</div>}
          {step === "verify" ? (
            <form onSubmit={handleVerify} className="space-y-4">
              <div><label className="block text-sm font-medium text-slate-300 mb-1">{t("recover.phone_number")}</label>
                <input type="tel" value={form.phone} onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "");
                  update("phone", maskPhone(raw));
                }} placeholder="+55 (11) 9 9999-9999"
                  className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700 text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500" required /></div>
              <div><label className="block text-sm font-medium text-slate-300 mb-1">{t("recover.birth_date")}</label>
                <input type="date" value={form.birth_date} onChange={(e) => update("birth_date", e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700 text-white focus:ring-2 focus:ring-indigo-500" required /></div>
              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium transition-all flex items-center justify-center gap-2">
                {loading ? <div className="w-5 h-5 border-2 border-[var(--border-strong)] border-t-white rounded-full animate-spin" /> : <Phone className="w-5 h-5" />}
                {t("recover.verify_identity_btn")}
              </button>
            </form>
          ) : (
            <form onSubmit={handleConfirm} className="space-y-4">
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-2">
                <CheckCircle className="w-4 h-4" /> {t("recover.code_sent")}
              </div>
              <div><label className="block text-sm font-medium text-slate-300 mb-1">{t("recover.code_label")}</label>
                <input type="text" value={code} inputMode="numeric" autoComplete="one-time-code" maxLength={8}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder={t("recover.code_placeholder")}
                  className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700 text-white placeholder-slate-500 tracking-[0.4em] text-center focus:ring-2 focus:ring-indigo-500" required /></div>
              <div><label className="block text-sm font-medium text-slate-300 mb-1">{t("recover.new_password")}</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8}
                  placeholder={t("register.min_8_chars")} className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700 text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500" required /></div>
              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium transition-all flex items-center justify-center gap-2">
                {loading ? <div className="w-5 h-5 border-2 border-[var(--border-strong)] border-t-white rounded-full animate-spin" /> : <KeyRound className="w-5 h-5" />}
                {t("recover.confirm_btn")}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
