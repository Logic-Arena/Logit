import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserState {
  userId: string;
  username: string;
  setUsername: (name: string) => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      userId: crypto.randomUUID(),
      username: '',
      setUsername: (name) => set({ username: name }),
    }),
    {
      name: 'logic-arena-user',
      partialize: (state) => ({ userId: state.userId, username: state.username }),
    }
  )
);
