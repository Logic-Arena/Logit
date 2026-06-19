export interface PhaseDurations {
  arguing?: number;
  rebuttal?: number;
  defense?: number;
  counter?: number;
  finalArgument?: number;
  peerVoting?: number;
}

export interface TeacherSettings {
  enabled: boolean;
  vocab: boolean;
  evidenceLimit: boolean;
  rebuttalLimit: boolean;
  phaseDurations?: PhaseDurations | null;
}

export interface AuthUserStats {
  tier: string;
  rank_point: number;
  score_average: number;
  total_games: number;
  win_count: number;
  badges: unknown[];
}

export interface AuthUser {
  id: number;
  provider: string;
  username: string | null;
  email: string | null;
  name: string | null;
  profile_image?: string | null;
  role?: 'student' | 'teacher';
  stats?: AuthUserStats | null;
  teacher_settings?: TeacherSettings | null;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role?: 'student' | 'teacher';
  teacher_settings?: TeacherSettings | null;
  tier?: string;
  tierRank?: number;
  nextTier?: string;
  scoreAverage?: number;
  debateCount?: number;
  winCount?: number;
  avatarUrl?: string;
  badges?: { icon: string; label: string }[];
}

