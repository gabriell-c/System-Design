import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AuthUser = {
  id: number;
  username: string;
  email: string;
  role: string;
  phone?: string;
  birth_date?: string;
  auto_save_enabled: boolean;
  auto_save_interval_minutes: number;
  created_at: string;
  updated_at: string;
};

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (username: string, password: string, remember_me: boolean) => Promise<boolean>;
  logout: () => Promise<void>;
  register: (data: {
    username: string;
    email: string;
    password: string;
    phone?: string;
    birth_date?: string;
  }) => Promise<boolean>;
  fetchProfile: () => Promise<void>;
  updateProfile: (data: Partial<AuthUser>) => Promise<boolean>;
  setUser: (user: AuthUser | null) => void;
  setToken: (token: string | null) => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4410';

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,

      login: async (username: string, password: string, remember_me: boolean) => {
        try {
          const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username, password, remember_me }),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Login failed');
          }

          const data = await response.json();
          set({
            user: data.user,
            token: data.access_token,
            isAuthenticated: true,
          });
          return true;
        } catch (error) {
          console.error('Login error:', error);
          return false;
        }
      },

      logout: async () => {
        try {
          await fetch(`${API_BASE}/api/v1/auth/logout`, {
            method: 'POST',
            credentials: 'include',
          });
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          set({ user: null, token: null, isAuthenticated: false });
        }
      },

      register: async (data) => {
        try {
          const response = await fetch(`${API_BASE}/api/v1/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Registration failed');
          }

          return true;
        } catch (error) {
          console.error('Registration error:', error);
          return false;
        }
      },

      fetchProfile: async () => {
        try {
          const response = await fetch(`${API_BASE}/api/v1/auth/me`, {
            credentials: 'include',
          });

          if (response.ok) {
            const user = await response.json();
            set({ user, isAuthenticated: true });
          } else {
            set({ user: null, isAuthenticated: false });
          }
        } catch (error) {
          console.error('Fetch profile error:', error);
          set({ user: null, isAuthenticated: false });
        } finally {
          set({ isLoading: false });
        }
      },

      updateProfile: async (data) => {
        try {
          const response = await fetch(`${API_BASE}/api/v1/profile/`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(data),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Update failed');
          }

          const updatedUser = await response.json();
          set({ user: updatedUser });
          return true;
        } catch (error) {
          console.error('Update profile error:', error);
          return false;
        }
      },

      setUser: (user) => set({ user }),
      setToken: (token) => set({ token }),
    }),
    {
      name: 'archia-auth-storage',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
