"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, User } from "lucide-react";
import { useAuthStore, type AuthUser } from "@/lib/auth-store";

type FormState = {
  username: string;
  email: string;
  phone: string;
  birth_date: string;
  auto_save_enabled: boolean;
  auto_save_interval_minutes: number;
};

function formFromUser(user: AuthUser): FormState {
  return {
    username: user.username || "",
    email: user.email || "",
    phone: user.phone || "",
    birth_date: user.birth_date || "",
    auto_save_enabled: user.auto_save_enabled ?? true,
    auto_save_interval_minutes: user.auto_save_interval_minutes ?? 15,
  };
}

function ProfileForm({ user }: { user: AuthUser }) {
  const { updateProfile, logout } = useAuthStore();
  const router = useRouter();
  const [form, setForm] = useState(() => formFromUser(user));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const handleSave = async () => {
    setSaving(true);
    setMsg("");
    const ok = await updateProfile({
      username: form.username,
      email: form.email,
      phone: form.phone || undefined,
      birth_date: form.birth_date || undefined,
      auto_save_enabled: form.auto_save_enabled,
      auto_save_interval_minutes: form.auto_save_interval_minutes,
    });
    setSaving(false);
    setMsg(ok ? "Profile updated!" : "Failed to update profile");
  };

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const update = (field: string, value: string | boolean | number) =>
    setForm((p) => ({ ...p, [field]: value }));

  return (
    <div className="min-h-screen bg-[#070b10] p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Editor
        </Link>
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center">
              <User className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Profile Settings</h1>
              <p className="text-sm text-slate-400">Manage your account and preferences</p>
            </div>
          </div>
          {msg && (
            <div
              className={`mb-6 p-3 rounded-lg text-sm ${
                msg.includes("Failed")
                  ? "bg-red-500/10 border border-red-500/20 text-red-400"
                  : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
              }`}
            >
              {msg}
            </div>
          )}
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Username</label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => update("username", e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Phone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  placeholder="+55 11 99999-9999"
                  className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700 text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Birth Date</label>
                <input
                  type="date"
                  value={form.birth_date}
                  onChange={(e) => update("birth_date", e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>
            </div>
            <div className="border-t border-slate-800 pt-6">
              <h3 className="text-lg font-semibold text-white mb-4">Auto-Save Settings</h3>
              <div className="flex items-center gap-4 mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.auto_save_enabled}
                    onChange={(e) => update("auto_save_enabled", e.target.checked)}
                    className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500"
                  />
                  <span className="text-slate-300">Enable auto-save</span>
                </label>
              </div>
              {form.auto_save_enabled && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Save interval</label>
                  <select
                    value={form.auto_save_interval_minutes}
                    onChange={(e) => update("auto_save_interval_minutes", parseInt(e.target.value, 10))}
                    className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  >
                    <option value={5}>Every 5 minutes</option>
                    <option value={15}>Every 15 minutes</option>
                    <option value={30}>Every 30 minutes</option>
                    <option value={60}>Every 1 hour</option>
                  </select>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between pt-4">
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all text-sm"
              >
                Logout
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium transition-all flex items-center gap-2"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user, fetchProfile, isLoading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#070b10]">
        <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    router.push("/login");
    return null;
  }

  return <ProfileForm key={user.id} user={user} />;
}
