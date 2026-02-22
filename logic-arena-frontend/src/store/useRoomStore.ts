import { create } from 'zustand';
import type { Room, Phase, VoteTally, VoteOption } from '../types/room';

interface RoomState {
  room: Room | null;
  mySocketId: string;
  voteTally: VoteTally;
  // Actions
  setRoom: (room: Room) => void;
  updateRoom: (room: Room) => void;
  setPhase: (phase: Phase, topic?: string) => void;
  setVoteTally: (tally: VoteTally) => void;
  setMySocketId: (id: string) => void;
  resetRoom: () => void;
  updateUserVote: (socketId: string, vote: VoteOption) => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  room: null,
  mySocketId: '',
  voteTally: { pro: 0, con: 0 },

  setRoom: (room) => {
    let pro = 0;
    let con = 0;
    for (const u of Object.values(room.users)) {
      if (u.vote === 'pro') pro++;
      else if (u.vote === 'con') con++;
    }
    set({ room, voteTally: { pro, con } });
  },

  updateRoom: (room) => set({ room }),

  setPhase: (phase, topic) =>
    set((state) => {
      if (!state.room) return {};
      return { room: { ...state.room, phase, topic: topic ?? state.room.topic } };
    }),

  setVoteTally: (tally) => set({ voteTally: tally }),

  setMySocketId: (id) => set({ mySocketId: id }),

  resetRoom: () => set({ room: null, mySocketId: '', voteTally: { pro: 0, con: 0 } }),

  updateUserVote: (socketId, vote) =>
    set((state) => {
      if (!state.room) return {};
      const users = { ...state.room.users };
      if (users[socketId]) users[socketId] = { ...users[socketId], vote };
      return { room: { ...state.room, users } };
    }),
}));
