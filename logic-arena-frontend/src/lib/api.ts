import type { Room, RoomMode, TopicMode } from '../types/room';
import type { User, AuthResponse } from '../types/user';
import { useUserStore } from '../store/useUserStore';

const BASE = import.meta.env.VITE_API_URL as string;

/** 인증 토큰 포함 헤더 헬퍼 */
function authHeaders(): HeadersInit {
  const token = useUserStore.getState().token;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// ─── Auth ────────────────────────────────────────────────

export async function login(loginId: string, password: string): Promise<AuthResponse> {
  // ── 개발용 임시 로그인 (admin / admin) ──────────────────
  if (loginId === 'admin' && password === 'admin') {
    return {
      token: 'dev-token-admin',
      user: {
        id: 'dev-user-001',
        name: 'Admin',
        email: 'admin@logit.dev',
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
      },
    };
  }
  // ────────────────────────────────────────────────────────

  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login_id: loginId, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? '로그인에 실패했습니다');
  }
  return res.json();
}

export async function signup(
  loginId: string,
  password: string,
  name: string,
  email?: string,
): Promise<AuthResponse> {
  const res = await fetch(`${BASE}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login_id: loginId, password, name, email }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? '회원가입에 실패했습니다');
  }
  return res.json();
}

export async function getMe(): Promise<User> {
  const res = await fetch(`${BASE}/auth/me`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('인증 정보를 불러오지 못했습니다');
  return res.json();
}

// ─── Rooms ───────────────────────────────────────────────

export async function getRooms(): Promise<Room[]> {
  const res = await fetch(`${BASE}/rooms`, { headers: authHeaders() });
  if (!res.ok) throw new Error('방 목록을 불러오지 못했습니다');
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
    const err = await res.json().catch(() => ({}));6
    throw new Error((err as { error?: string }).error ?? '방 생성에 실패했습니다');
  }
  return res.json();
}
