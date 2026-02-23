import type { RoomMode } from '../types/room';

export const ROOM_MODES: Record<RoomMode, {
  key: RoomMode;
  label: string;
  description: string;
  available: boolean;
}> = {
  free_debate: {
    key: 'free_debate',
    label: '자유토론',
    description: '참가자들끼리 자유롭게 토론하는 모드',
    available: true,
  },
  ai_debate: {
    key: 'ai_debate',
    label: 'AI 모드',
    description: 'AI와 함께 1:1로 토론하는 모드',
    available: true,
  },
} as const;
