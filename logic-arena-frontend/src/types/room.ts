export type PlayerRole = 'pro_player' | 'con_player' | 'observer';
export type UserRole = 'host' | 'participant' | 'observer' | 'ai';
export type VoteOption = 'pro' | 'con';
export type WinnerSide = 'pro' | 'con' | 'draw';
export type RoomMode = 'ai_debate' | 'human_debate';
export type TopicMode = 'manual' | 'ai_auto';
export type TopicSource = 'ai' | 'fallback';

export type Phase =
  | 'waiting'
  | 'topic_selection'
  | 'arguing'
  | 'pro_p_rebuttal'
  | 'pro_p_defense'
  | 'pro_p_counter'
  | 'con_p_rebuttal'
  | 'con_p_defense'
  | 'con_p_counter'
  | 'pro_a_rebuttal'
  | 'pro_a_defense'
  | 'pro_a_counter'
  | 'con_a_rebuttal'
  | 'con_a_defense'
  | 'con_a_counter'
  | 'coaching'
  | 'final_argument'
  | 'judging'
  | 'peer_voting'
  | 'ended';

export interface Player {
  socketId: string;
  userId: string;
  username: string;
}

export interface RoomUser {
  username: string;
  userRole: UserRole;
  vote?: VoteOption | null;
}

export interface ChatMessage {
  id: string;
  userId: string | null;
  username: string;
  userRole: UserRole;
  vote: VoteOption | null;
  content: string;
  timestamp: string;
}

export interface RoomContent {
  pro_argument: string | null;
  con_argument: string | null;
  pro_ai_argument: string | null;
  con_ai_argument: string | null;
  pro_p_rebuttal: string | null;
  pro_p_defense_player: string | null;
  pro_p_defense_ai: string | null;
  pro_p_counter: string | null;
  con_p_rebuttal: string | null;
  con_p_defense_player: string | null;
  con_p_defense_ai: string | null;
  con_p_counter: string | null;
  pro_a_rebuttal: string | null;
  pro_a_defense_player: string | null;
  pro_a_defense_ai: string | null;
  pro_a_counter: string | null;
  con_a_rebuttal: string | null;
  con_a_defense_player: string | null;
  con_a_defense_ai: string | null;
  con_a_counter: string | null;
  coaching_pro: string | null;
  coaching_con: string | null;
  pro_final: string | null;
  con_final: string | null;
}

export interface ParticipantScore {
  name: string;
  vote: VoteOption;
  type: 'player' | 'ai';
  logic: number;
  evidence: number;
  persuasion: number;
  rebuttal: number;
  consistency: number;
  total: number;
  rank: number;
  advice: string;
  aiScore: number;
  peerVotes: number;
  peerScore: number;
  finalScore: number;
}

export interface DebateResult {
  winner: WinnerSide;
  summary: string;
  scores: ParticipantScore[];
}

export interface Room {
  id: string;
  title: string;
  hasPassword: boolean;
  mode: RoomMode;
  topicMode: TopicMode;
  topic: string | null;
  topicSource: TopicSource | null;
  phase: Phase;
  phaseEndAt: number | null;
  host: string | null;
  proPlayer: Player | null;
  conPlayer: Player | null;
  observers: Array<{ socketId: string; userId: string; username: string }>;
  content: RoomContent;
  result: DebateResult | null;
  createdAt: string;
  sideSelectionAttempts: number;
  coachingEnabled: boolean;
}
