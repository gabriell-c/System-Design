"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, UserPlus } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { useTranslation } from "@/i18n";

export default function RegisterPage() {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    birth_date: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuthStore();
  const router = useRouter();

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (form.password !== form.confirmPassword) {
      setError(t("register.passwords_no_match"));
      return;
    }
    if (form.password.length < 8) {
      setError(t("register.password_min_8"));
      return;
    }

    setIsLoading(true);
    try {
      const success = await register({
        username: form.username,
        email: form.email,
        password: form.password,
        phone: form.phone || undefined,
        birth_date: form.birth_date || undefined,
      });
      if (success) {
        setSuccess(t("register.account_created"));
        setTimeout(() => router.push("/login"), 1500);
      } else {
        setError(t("register.registration_failed"));
      }
    } catch {
      setError(t("auth.error_try_again"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Archia</h1>
          <p className="text-[var(--muted-fg)]">{t("register.create_account")}</p>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-8 elev-3">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">{t("register.sign_up")}</h2>
              <p className="text-sm text-[var(--muted-fg)]">{t("register.create_new_account")}</p>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">{t("auth.username")} *</label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => update("username", e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                placeholder={t("register.choose_username")}
                required
                minLength={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">{t("register.email")} *</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                placeholder={t("register.your_email")}
                required
              />
            </div>

            <div className="relative">
              <label className="block text-sm font-medium text-slate-300 mb-1">{t("auth.password")} *</label>
              <input
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all pr-12"
                placeholder={t("register.min_8_chars")}
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-9 text-[var(--muted-fg)] hover:text-white transition-colors"
                aria-label={showPassword ? t("auth.hide_password") : t("auth.show_password")}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">{t("register.confirm_password")} *</label>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(e) => update("confirmPassword", e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                placeholder={t("register.repeat_password")}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">{t("register.phone_optional")}</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                placeholder="+55 11 99999-9999"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">{t("register.birth_date_optional")}</label>
              <input
                type="date"
                value={form.birth_date}
                onChange={(e) => update("birth_date", e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-[var(--border-strong)] border-t-white rounded-full animate-spin" />
                  {t("register.creating_account")}
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  {t("register.sign_up")}
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-[var(--muted-fg)]">
            {t("register.already_have_account")}{" "}
            <Link href="/login" className="text-indigo-400 hover:text-indigo-300 transition-colors">
              {t("auth.sign_in")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
