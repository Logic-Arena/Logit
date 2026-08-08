import type { Room, RoomMode, TopicMode } from '../types/room';
import type { User, AuthUser } from '../types/user';
import { useUserStore } from '../store/useUserStore';

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

export function handleSessionExpired() {
  useUserStore.getState().logout();
  window.location.href = '/login';
}

async function authedFetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status === 401) {
    const data = await res.clone().json().catch(() => ({}));
    if (data?.error?.includes('다른 기기')) {
      handleSessionExpired();
    }
  }
  return res;
}

const TIER_LIST = [
  '브론즈 5', '브론즈 4', '브론즈 3', '브론즈 2', '브론즈 1',
  '실버 5', '실버 4', '실버 3', '실버 2', '실버 1',
  '골드 5', '골드 4', '골드 3', '골드 2', '골드 1',
  '플래티넘 5', '플래티넘 4', '플래티넘 3', '플래티넘 2', '플래티넘 1',
  '다이아몬드',
];

const TIER_RP_MIN = [0, 100, 200, 300, 400, 500, 650, 800, 950, 1100, 1300, 1500, 1750, 2000, 2300, 2600, 3000, 3500, 4000, 4600, 5000];

export function createHybridUser(authUser: AuthUser): User {
  const stats = authUser.stats;
  const tierIdx = Math.max(0, TIER_LIST.indexOf(stats?.tier ?? '브론즈 5'));
  const rankPoint = stats?.rank_point ?? 0;
  const currentMin = TIER_RP_MIN[tierIdx] ?? 0;
  const inTierRp = Math.max(0, rankPoint - currentMin);
  // 1칸 = 20 RP (WIN_RP=20이므로 1승=1칸, 5승=다음티어)
  const slots = Math.min(4, Math.floor(inTierRp / 20));
  return {
    id: authUser.id.toString(),
    name: authUser.name || authUser.username || '이름없음',
    email: authUser.email || '',
    role: authUser.role ?? 'student',
    teacher_settings: authUser.teacher_settings ?? null,
    tier: stats?.tier ?? '브론즈 5',
    tierRank: slots * 20,
    nextTier: tierIdx < TIER_LIST.length - 1 ? TIER_LIST[tierIdx + 1] : undefined,
    scoreAverage: stats?.score_average ?? 0,
    debateCount: stats?.total_games ?? 0,
    winCount: stats?.win_count ?? 0,
    avatarUrl: authUser.profile_image ?? undefined,
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

export async function updateProfile({ name, profileImage }: { name?: string; profileImage?: string | null }): Promise<User> {
  const res = await fetch(`${BASE}/auth/profile`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ name, profileImage }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? '프로필 수정에 실패했습니다.');
  }
  const data = await res.json();
  return createHybridUser(data);
}

// ─── Rooms ───────────────────────────────────────────────

export async function getRooms(): Promise<Room[]> {
  const res = await authedFetch(`${BASE}/rooms`, { headers: authHeaders() });
  if (!res.ok) throw new Error('방 목록을 불러오지 못했습니다.');
  return res.json();
}

export async function createRoom(
  title: string,
  mode: RoomMode = 'ai_debate',
  topicMode: TopicMode = 'ai_auto',
  topic?: string,
  password?: string,
  handicap?: Record<string, unknown> | null,
  coachingEnabled: boolean = true,
  structuredArgumentEnabled: boolean = true,
): Promise<Room> {
  const res = await fetch(`${BASE}/rooms`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      title, mode, topicMode,
      ...(topic !== undefined && { topic }),
      ...(password !== undefined && { password }),
      ...(handicap !== undefined && handicap !== null && { handicap }),
      coachingEnabled,
      structuredArgumentEnabled,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? '방 생성에 실패했습니다.');
  }

  return res.json();
}

export async function verifyRoomPassword(roomId: string, password: string): Promise<void> {
  const res = await fetch(`${BASE}/rooms/${roomId}/verify-password`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? '비밀번호가 틀렸습니다.');
  }
}

export async function signupLocal(payload: {
  username: string;
  password: string;
  name?: string;
  email?: string;
  teacherCode?: string;
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
  consistency: number;
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
  badge: string | null; // 'HOT' 배지 (서버에서 계산)
  pro_votes: number;
  con_votes: number;
  myVote?: 'pro' | 'con' | null;
  expires_at: string;
  activated_at: string | null; // 주제 활성화 시각 (NEW 배지 계산용)
  slot: string;
  category_fixed?: string;
  display_order?: number;
  status?: string;
}

export async function getCommunityTopics(): Promise<CommunityTopic[]> {
  try {
    const res = await authedFetch(`${BASE}/community-topics`, { headers: authHeaders() });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `주제 목록을 불러올 수 없습니다. (상태: ${res.status})`);
    }
    return res.json();
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('네트워크 연결을 확인해주세요.');
    }
    throw error;
  }
}

export async function voteOnTopic(id: number, vote: 'pro' | 'con'): Promise<{ myVote: 'pro' | 'con' | null; topic: CommunityTopic }> {
  try {
    const res = await fetch(`${BASE}/community-topics/${id}/vote`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ vote }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      if (res.status === 401) {
        throw new Error('로그인이 필요합니다.');
      }
      if (res.status === 404) {
        throw new Error('투표 주제를 찾을 수 없습니다.');
      }
      if (res.status === 410) {
        throw new Error('이 주제는 만료되었습니다.');
      }
      if (res.status === 409) {
        throw new Error('이미 투표한 주제입니다.');
      }
      if (res.status === 503) {
        throw new Error('서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.');
      }
      throw new Error(errorData.error || '투표에 실패했습니다.');
    }

    return res.json();
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('네트워크 연결을 확인해주세요.');
    }
    throw error;
  }
}

export interface TrainingRecommendation {
  title: string;
  description: string;
  topic: string;
}

export async function getTrainingRecommendation(): Promise<TrainingRecommendation | null> {
  const res = await authedFetch(`${BASE}/training-recommendation`, { headers: authHeaders() });
  if (!res.ok) return null;
  return res.json();
}

// ─── Teacher API ─────────────────────────────────────────────

export interface ClassInfo {
  id: number;
  name: string;
  classCode: string;
  memberCount: number;
  createdAt: string;
}

export interface StudentStat {
  userId: number;
  name: string;
  joinedAt: string;
  tier: string;
  rankPoint: number;
  totalGames: number;
  winCount: number;
  avgScore: number;
  avgLogic: number;
  avgEvidence: number;
  avgPersuasion: number;
  avgRebuttal: number;
  avgConsistency: number;
  growthRate: number;
  recentDebates: {
    id: number;
    topic: string;
    position: string;
    result: string;
    score: number;
    logic: number;
    evidence: number;
    persuasion: number;
    rebuttal: number;
    consistency: number;
    advice: string | null;
    playedAt: string;
  }[];
}

export interface ClassSummary {
  totalDebates: number;
  avgScore: number;
  topStudents: { userId: number; name: string; avgScore: number; debateCount: number }[];
  avgByCategory: { logic: number; evidence: number; persuasion: number; rebuttal: number; consistency: number };
  weakestCategory: { key: string; avg: number } | null;
  recentDebates: { topic: string; result: string; score: number; studentName: string; playedAt: string }[];
}

export async function getTeacherClasses(token: string): Promise<ClassInfo[]> {
  const res = await fetch(`${BASE}/teacher/classes`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('학급 목록 로드 실패');
  return res.json();
}

export async function createClass(token: string, name: string): Promise<ClassInfo> {
  const res = await fetch(`${BASE}/teacher/classes`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? '학급 생성 실패');
  }
  return res.json();
}

export async function deleteClass(token: string, classId: number): Promise<void> {
  const res = await fetch(`${BASE}/teacher/classes/${classId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('학급 삭제 실패');
}

export async function getClassStudents(token: string, classId: number): Promise<StudentStat[]> {
  const res = await fetch(`${BASE}/teacher/classes/${classId}/students`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('학생 목록 로드 실패');
  return res.json();
}

export async function getClassSummary(token: string, classId: number): Promise<ClassSummary> {
  const res = await fetch(`${BASE}/teacher/classes/${classId}/summary`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('통계 로드 실패');
  return res.json();
}

export interface TeacherDebateSummary {
  summary: string;
  strengths: string[];
  improvements: string[];
  coaching: string;
}

export async function getStoredDebateSummary(
  token: string,
  historyId: number
): Promise<TeacherDebateSummary | { pending: true }> {
  const res = await fetch(`${BASE}/teacher/debate-summary/${historyId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? '요약 로드 실패');
  }
  return res.json();
}

export async function joinClass(token: string, classCode: string): Promise<{ ok: boolean; alreadyJoined: boolean; className: string }> {
  const res = await fetch(`${BASE}/teacher/join`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ classCode }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? '학급 참가 실패');
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
