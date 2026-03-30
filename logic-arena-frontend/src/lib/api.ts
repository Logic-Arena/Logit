import type { Room, RoomMode, TopicMode } from '../types/room';
import type { User } from '../types/user';
import { useUserStore } from '../store/useUserStore';

const BASE = import.meta.env.VITE_API_URL as string;

export interface AuthUser {
  id: number;
  provider: string;
  username: string | null;
  email: string | null;
  name: string | null;
  profile_image?: string | null;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: AuthUser;
}

/** 인증 토큰 포함 헤더 헬퍼 */
function authHeaders(): HeadersInit {
  const token = useUserStore.getState().token;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** 
 * 하이브리드 유저 객체 생성기 (UI 깨짐 방지용)
 * 실제 백엔드 계정 정보 + 프론트엔드 통계 목데이터
 */
export function createHybridUser(authUser: AuthUser): User {
  return {
    id: authUser.id.toString(),
    name: authUser.name || authUser.username || '이름없음',
    email: authUser.email || '',
    tier: 'Silver II',
    tierRank: 62,
    nextTier: 'Silver I',
    scoreAverage: 84,
    debateCount: 42,
    winCount: 27,
    badges: [
      { icon: '🔥', label: '열정 토론가' },
      { icon: '🎯', label: '논리 명수' },
      { icon: '⚡', label: '속전속결' },
    ],
  };
}

export async function getMe(): Promise<User> {
  const res = await fetch(`${BASE}/auth/me`, {
    headers: authHeaders(),
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
): Promise<Room> {
  const res = await fetch(`${BASE}/rooms`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ title, mode, topicMode, ...(topic !== undefined && { topic }) }),
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
