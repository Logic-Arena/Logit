import type { Room, RoomMode, TopicMode } from '../types/room';

const BASE = import.meta.env.VITE_API_URL as string;

export interface AuthUser {
  id: number;
  provider: string;
  username: string | null;
  email: string | null;
  name: string | null;
  profile_image?: string | null;
}

interface AuthResponse {
  message: string;
  token: string;
  user: AuthUser;
}

export async function getRooms(): Promise<Room[]> {
  const res = await fetch(`${BASE}/rooms`);
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
    headers: { 'Content-Type': 'application/json' },
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
