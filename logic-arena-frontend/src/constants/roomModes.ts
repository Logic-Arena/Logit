import type { RoomMode } from '../types/room';

export const ROOM_MODES: Record<RoomMode, {
  key: RoomMode;
  label: string;
  description: string;
  available: boolean;
}> = {
  ai_debate: {
    key: 'ai_debate',
    label: 'AI 모드',
    description: 'AI와 함께 1:1로 토론하는 모드',
    available: true,
  },
  human_debate: {
    key: 'human_debate',
    label: '인간 vs 인간',
    description: 'AI 없이 인간끼리만 토론하는 모드 (최종 변론 시 훈수 AI 제공)',
    available: true,
  },
  solo_essay: {
    key: 'solo_essay',
    label: '개인 논술',
    description: '혼자서 주장문을 작성하고 AI 피드백을 받아 퇴고하는 논술 연습',
    available: true,
  },
} as const;

