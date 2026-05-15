import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DebateResult, VoteOption } from '../types/room';

export interface DebateHistoryItem {
  id: string;
  roomId: string;
  roomTitle: string;
  topic: string | null;
  endedAt: string;
  winner: DebateResult['winner'];
  summary: string;
  mySide: VoteOption | null;
  result: DebateResult;
}

interface DebateHistoryState {
  items: DebateHistoryItem[];
  addHistory: (item: DebateHistoryItem) => void;
}

export const useDebateHistoryStore = create<DebateHistoryState>()(
  persist(
    (set) => ({
      items: [],
      addHistory: (item) =>
        set((state) => {
          const deduped = state.items.filter((entry) => entry.roomId !== item.roomId);
          return { items: [item, ...deduped].slice(0, 30) };
        }),
    }),
    {
      name: 'logic-arena-debate-history',
    }
  )
);
