import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types/user';

interface UserState {
  token: string | null;
  user: User | null;
  isLoggedIn: boolean;

  setAuth: (token: string, user: User) => void;
  setUser: (user: User) => void;
  logout: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isLoggedIn: false,

      setAuth: (token, user) => set({ token, user, isLoggedIn: true }),
      setUser: (user) => set({ user }),
      logout: () => {
        const token = get().token;
        if (token) void fetch(`${import.meta.env.VITE_API_URL ?? '/api'}/auth/logout`, {
          method: 'POST', headers: { Authorization: `Bearer ${token}` }, keepalive: true,
        }).catch(() => {});
        set({ token: null, user: null, isLoggedIn: false });
      },
    }),
    {
      name: 'logic-arena-auth',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isLoggedIn: state.isLoggedIn,
      }),
    }
  )
);
