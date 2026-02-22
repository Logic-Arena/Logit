export type UserRole = 'host' | 'participant' | 'observer';
export type VoteOption = 'pro' | 'con';
export type Phase = 'waiting' | 'voting';

export interface RoomUser {
  userId: string;
  username: string;
  userRole: UserRole;
  vote: VoteOption | null;
}

export interface Room {
  id: string;
  title: string;
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
