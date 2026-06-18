export interface TeacherSettings {
  enabled: boolean;
  vocab: boolean;
  evidenceLimit: boolean;
  rebuttalLimit: boolean;
  shortGameMode?: boolean;
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

export interface AuthResponse {
  user: User;
  token: string;
}
