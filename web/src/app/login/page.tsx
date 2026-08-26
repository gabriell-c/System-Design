"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  Check,
  Command,
  Eye,
  EyeOff,
  KeyRound,
  LogIn,
  User,
  UserPlus,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { useTranslation } from "@/i18n";

export default function LoginPage() {
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    const root = document.documentElement;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    root.classList.remove("archia-light");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    root.classList.add("archia-dark");
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const success = await login(username, password, rememberMe);
      if (success) {
        router.push("/");
      } else {
        setError(t("auth.invalid_credentials"));
      }
    } catch {
      setError(t("auth.error_try_again"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-400 to-indigo-600 elev-2">
            <Command className="h-6 w-6 text-slate-950" />
          </div>
          <h1 className="mb-2 text-3xl font-bold text-white">Archia</h1>
          <p className="text-slate-300">{t("auth.system_design_editor")}</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 elev-3">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20">
              <LogIn className="h-5 w-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">{t("auth.sign_in")}</h2>
              <p className="text-sm text-slate-300">{t("auth.access_your_account")}</p>
            </div>
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-300">
                <User className="h-3.5 w-3.5" />
                {t("auth.username")}
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/50 py-3 pr-4 pl-10 text-white placeholder-slate-500 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder={t("auth.enter_your_username")}
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-300">
                <KeyRound className="h-3.5 w-3.5" />
                {t("auth.password")}
              </label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/50 py-3 pr-12 pl-10 text-white placeholder-slate-500 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder={t("auth.enter_your_password")}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-[var(--muted-fg)] transition-colors hover:text-white"
                  aria-label={showPassword ? t("auth.hide_password") : t("auth.show_password")}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0"
                />
                <span className="inline-flex items-center gap-2 text-sm text-slate-300">
                  <Check className="h-3.5 w-3.5" />
                  {t("auth.remember_me_7_days")}
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-medium text-white transition-all hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--border-strong)] border-t-white" />
                  {t("auth.signing_in")}
                </>
              ) : (
                <>
                  <LogIn className="h-5 w-5" />
                  {t("auth.sign_in")}
                </>
              )}
            </button>
          </form>

          <div className="mt-6 space-y-3">
            <Link
              href="/recover"
              className="block text-center text-sm text-indigo-300 underline underline-offset-2 transition-colors hover:text-indigo-200"
            >
              {t("auth.forgot_password")}
            </Link>
            <div className="flex items-center justify-center gap-1.5 text-center text-sm text-slate-300">
              <UserPlus className="h-3.5 w-3.5" />
              {t("auth.no_account")}{" "}
              <Link
                href="/register"
                className="font-medium text-indigo-300 underline underline-offset-2 hover:text-indigo-200"
              >
                {t("auth.sign_up")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
