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
    (set) => ({
      token: null,
      user: null,
      isLoggedIn: false,

      setAuth: (token, user) => set({ token, user, isLoggedIn: true }),
      setUser: (user) => set({ user }),
      logout: () => set({ token: null, user: null, isLoggedIn: false }),
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
