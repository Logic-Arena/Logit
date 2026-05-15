import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUserStats {
  tier: string;
  rank_point: number;
  score_average: number;
  total_games: number;
  win_count: number;
  badges: unknown[];
}

export interface AuthUser {
  id: number;
  provider: string;
  username: string | null;
  email: string | null;
  name: string | null;
  profile_image?: string | null;
  stats?: AuthUserStats | null;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  setUser: (user: AuthUser) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      login: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
      setUser: (user) => set({ user }),
    }),
    {
      name: 'logic-arena-auth',
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
);
