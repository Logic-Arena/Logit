export interface User {
  id: string;
  name: string;
  email: string;
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
