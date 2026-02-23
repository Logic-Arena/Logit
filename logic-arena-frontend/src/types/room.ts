export type UserRole = 'host' | 'participant' | 'observer' | 'ai';
export type VoteOption = 'pro' | 'con';
export type Phase = 'waiting' | 'voting';
export type RoomMode = 'free_debate' | 'ai_debate';

export interface RoomUser {
  userId: string;
  username: string;
  userRole: UserRole;
  vote: VoteOption | null;
}

export interface Room {
  id: string;
  title: string;
  mode: RoomMode;
  topic: string | null;
  phase: Phase;
  createdAt: string;
  users: Record<string, RoomUser>; // socketId -> RoomUser
}

export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  userRole: UserRole;
  vote: VoteOption | null;
  content: string;
  timestamp: string;
}

export interface VoteTally {
  pro: number;
  con: number;
}
