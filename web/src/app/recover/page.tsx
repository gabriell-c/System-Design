"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, KeyRound, Phone, CheckCircle } from "lucide-react";
import { useTranslation } from "@/i18n";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4410";

type Step = "verify" | "reset";

export default function RecoverPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [step, setStep] = useState<Step>("verify");
  const [form, setForm] = useState({ username: "", phone: "", birth_date: "" });
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const r = await fetch(`${API}/api/v1/auth/recover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.detail || t("recover.verification_failed")); return; }
      setResetToken(data.reset_token);
      setStep("reset");
    } catch { setError(t("recover.network_error")); } finally { setLoading(false); }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const r = await fetch(`${API}/api/v1/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetToken, new_password: newPassword }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.detail || t("recover.reset_failed")); return; }
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
              <div><label className="block text-sm font-medium text-slate-300 mb-1">{t("auth.username")}</label>
                <input type="text" value={form.username} onChange={(e) => update("username", e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700 text-white focus:ring-2 focus:ring-indigo-500" required /></div>
              <div><label className="block text-sm font-medium text-slate-300 mb-1">{t("recover.phone_number")}</label>
                <input type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+55 11 99999-9999"
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
            <form onSubmit={handleReset} className="space-y-4">
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-2">
                <CheckCircle className="w-4 h-4" /> {t("recover.identity_verified")}
              </div>
              <div><label className="block text-sm font-medium text-slate-300 mb-1">{t("recover.new_password")}</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8}
                  placeholder={t("register.min_8_chars")} className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700 text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500" required /></div>
              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium transition-all flex items-center justify-center gap-2">
                {loading ? <div className="w-5 h-5 border-2 border-[var(--border-strong)] border-t-white rounded-full animate-spin" /> : <KeyRound className="w-5 h-5" />}
                {t("recover.reset_password_btn")}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
