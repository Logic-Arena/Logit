import type { Room, RoomMode, TopicMode } from '../types/room';
import type { User } from '../types/user';
import { useUserStore } from '../store/useUserStore';
import type { AuthUser } from '../store/useAuthStore';

const BASE = import.meta.env.VITE_API_URL ?? '/api';

export interface AuthResponse {
  message: string;
  token: string;
  user: AuthUser;
}

function authHeaders(): HeadersInit {
  const token = useUserStore.getState().token;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

const TIER_LIST = [
  '브론즈 5','브론즈 4','브론즈 3','브론즈 2','브론즈 1',
  '실버 5','실버 4','실버 3','실버 2','실버 1',
  '골드 5','골드 4','골드 3','골드 2','골드 1',
  '플래티넘 5','플래티넘 4','플래티넘 3','플래티넘 2','플래티넘 1',
  '다이아몬드',
];

export function createHybridUser(authUser: AuthUser): User {
  const stats = authUser.stats;
  const tierIdx = TIER_LIST.indexOf(stats?.tier ?? '브론즈 5');
  return {
    id: authUser.id.toString(),
    name: authUser.name || authUser.username || '이름없음',
    email: authUser.email || '',
    tier: stats?.tier ?? '브론즈 5',
    tierRank: tierIdx >= 0 ? tierIdx + 1 : 1,
    nextTier: tierIdx >= 0 && tierIdx < TIER_LIST.length - 1 ? TIER_LIST[tierIdx + 1] : undefined,
    scoreAverage: stats?.score_average ?? 0,
    debateCount: stats?.total_games ?? 0,
    winCount: stats?.win_count ?? 0,
    badges: (stats?.badges as { icon: string; label: string }[] | undefined) ?? [],
  };
}

export async function getMe(overrideToken?: string): Promise<User> {
  const token = overrideToken ?? useUserStore.getState().token;
  const res = await fetch(`${BASE}/auth/me`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error('인증 정보를 불러오지 못했습니다.');

  const data = await res.json();
  return createHybridUser(data);
}

// ─── Rooms ───────────────────────────────────────────────

export async function getRooms(): Promise<Room[]> {
  const res = await fetch(`${BASE}/rooms`, { headers: authHeaders() });
  if (!res.ok) throw new Error('방 목록을 불러오지 못했습니다.');
  return res.json();
}

export async function createRoom(
  title: string,
  mode: RoomMode = 'free_debate',
  topicMode: TopicMode = 'ai_auto',
  topic?: string,
  password?: string,
): Promise<Room> {
  const res = await fetch(`${BASE}/rooms`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      title, mode, topicMode,
      ...(topic !== undefined && { topic }),
      ...(password !== undefined && { password }),
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? '방 생성에 실패했습니다.');
  }

  return res.json();
}

export async function signupLocal(payload: {
  username: string;
  password: string;
  name?: string;
  email?: string;
}): Promise<AuthResponse> {
  const res = await fetch(`${BASE}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? '회원가입에 실패했습니다.');
  }

  return res.json();
}

export interface DebateHistoryItem {
  id: number;
  topic: string;
  position: string;
  score: number;
  logic: number;
  evidence: number;
  persuasion: number;
  rebuttal: number;
  advice: string | null;
  result: 'win' | 'lose' | 'draw';
  played_at: string;
}

export async function getDebateHistory(): Promise<DebateHistoryItem[]> {
  const res = await fetch(`${BASE}/debate-history`, {
    headers: authHeaders(),
  });
  if (!res.ok) return [];
  return res.json();
}

export interface CommunityTopic {
  id: number;
  question: string;
  category: string;
  badge: 'HOT' | 'NEW' | null;
  pro_votes: number;
  con_votes: number;
  myVote: 'pro' | 'con' | null;
}

export async function getCommunityTopics(): Promise<CommunityTopic[]> {
  const res = await fetch(`${BASE}/community-topics`, { headers: authHeaders() });
  if (!res.ok) return [];
  return res.json();
}

export async function voteOnTopic(id: number, vote: 'pro' | 'con'): Promise<{ myVote: 'pro' | 'con' | null; topic: CommunityTopic }> {
  const res = await fetch(`${BASE}/community-topics/${id}/vote`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ vote }),
  });
  if (!res.ok) throw new Error('투표에 실패했습니다.');
  return res.json();
}

export interface TrainingRecommendation {
  title: string;
  description: string;
  topic: string;
}

export async function getTrainingRecommendation(): Promise<TrainingRecommendation | null> {
  const res = await fetch(`${BASE}/training-recommendation`, { headers: authHeaders() });
  if (!res.ok) return null;
  return res.json();
}

export async function loginLocal(payload: {
  username: string;
  password: string;
}): Promise<AuthResponse> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? '로그인에 실패했습니다.');
  }

  return res.json();
}
