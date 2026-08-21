"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Users, Trash2, Shield } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4410";

interface UserData {
  id: number; username: string; email: string; role: string;
  phone?: string; birth_date?: string;
  auto_save_enabled: boolean; auto_save_interval_minutes: number;
  created_at: string; updated_at: string;
}

export default function AdminUsersPage() {
  const { user: currentUser } = useAuthStore();
  const router = useRouter();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser || currentUser.role !== "senior") {
      router.push("/");
      return;
    }
    fetch(`${API_BASE}/users/`, { credentials: "include" })
      .then((r) => r.json())
      .then(setUsers)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [currentUser, router]);

  const deleteUser = async (id: number) => {
    if (!confirm("Delete this user?")) return;
    await fetch(`${API_BASE}/users/${id}`, { method: "DELETE", credentials: "include" });
    setUsers((prev) => prev.filter((u) => u.id !== id));
  };

  const toggleRole = async (u: UserData) => {
    const newRole = u.role === "senior" ? "user" : "senior";
    const r = await fetch(`${API_BASE}/users/${u.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ role: newRole }),
    });
    if (r.ok) {
      setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, role: newRole } : x));
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#070b10]">
      <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#070b10] p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Editor
        </Link>
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center"><Users className="w-6 h-6 text-purple-400" /></div>
            <div><h1 className="text-2xl font-bold text-white">User Management</h1><p className="text-sm text-slate-400">Manage all users in the system</p></div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead><tr className="border-b border-slate-700 text-slate-400 text-sm">
                <th className="pb-3 pr-4">User</th>
                <th className="pb-3 pr-4">Email</th>
                <th className="pb-3 pr-4">Role</th>
                <th className="pb-3 pr-4">Auto-Save</th>
                <th className="pb-3">Actions</th>
              </tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors">
                    <td className="py-4 pr-4"><div className="text-white font-medium">{u.username}</div><div className="text-slate-500 text-xs">ID: {u.id}</div></td>
                    <td className="py-4 pr-4 text-slate-300">{u.email}</td>
                    <td className="py-4 pr-4">
                      <button onClick={() => toggleRole(u)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${u.role === "senior" ? "bg-purple-500/20 text-purple-400" : "bg-slate-700 text-slate-300"}`}>
                        <Shield className="w-3 h-3" /> {u.role}
                      </button>
                    </td>
                    <td className="py-4 pr-4 text-slate-300 text-sm">{u.auto_save_enabled ? `Every ${u.auto_save_interval_minutes}m` : "Off"}</td>
                    <td className="py-4">
                      {u.id !== currentUser?.id && (
                        <button onClick={() => deleteUser(u.id)} className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && <p className="text-center text-slate-500 py-8">No users found.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
