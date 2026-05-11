import { create } from 'zustand';
import type { Room, DebateResult, PlayerRole } from '../types/room';

function deriveMyRole(room: Room, mySocketId: string): PlayerRole {
  if (room.proPlayer?.socketId === mySocketId) return 'pro_player';
  if (room.conPlayer?.socketId === mySocketId) return 'con_player';
  return 'observer';
}

interface RoomState {
  room: Room | null;
  myRole: PlayerRole | null;
  mySocketId: string;
  debateResult: DebateResult | null;
  setRoom: (room: Room, myRole?: PlayerRole) => void;
  updateRoom: (room: Room) => void;
  setMySocketId: (id: string) => void;
  resetRoom: () => void;
  setDebateResult: (result: DebateResult) => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  room: null,
  myRole: null,
  mySocketId: '',
  debateResult: null,

  setRoom: (room, myRole) =>
    set(myRole !== undefined ? { room, myRole } : { room }),

  updateRoom: (room) => set((state) => ({
    room,
    myRole: state.mySocketId ? deriveMyRole(room, state.mySocketId) : state.myRole,
  })),

  setMySocketId: (id) => set({ mySocketId: id }),

  resetRoom: () => set({ room: null, myRole: null, mySocketId: '', debateResult: null }),

  setDebateResult: (result) => set({ debateResult: result }),
}));
