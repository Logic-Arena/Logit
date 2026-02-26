import type { TopicMode } from '../types/room';

export const TOPIC_MODES: Record<TopicMode, {
  key: TopicMode;
  label: string;
  description: string;
}> = {
  ai_auto: {
    key: 'ai_auto',
    label: 'AI 자동추천',
    description: 'AI가 토론 시작 시 주제를 자동으로 추천',
  },
  manual: {
    key: 'manual',
    label: '직접 입력',
    description: '방장이 원하는 주제를 직접 입력',
  },
} as const;
