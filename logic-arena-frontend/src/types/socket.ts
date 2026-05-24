import type { Room, PlayerRole, DebateResult } from './room';
import type { CommunityTopic } from '../lib/api';

export interface ClientToServerEvents {
  join_room: (payload: { roomId: string; userId: string; username: string; password?: string }) => void;
  leave_room: () => void;
  start_game: (payload: { roomId: string }) => void;
  select_side: (payload: { roomId: string; side: 'pro' | 'con' }) => void;
  submit_content: (payload: { roomId: string; text: string; skip?: boolean }) => void;
}

export interface ServerToClientEvents {
  room_list: (rooms: Room[]) => void;
  room_state: (payload: { room: Room; myRole: PlayerRole }) => void;
  player_joined: (payload: { room: Room }) => void;
  player_left: (payload: { room: Room | null }) => void;
  phase_changed: (payload: { phase: string; room: Room }) => void;
  topic_set: (payload: { topic: string | null; room: Room }) => void;
  sides_assigned: (payload: { random: boolean; room: Room }) => void;
  side_selection_update: (payload: { room: Room }) => void;
  side_selection_retry: (payload: { attempts: number; room: Room }) => void;
  ai_content: (payload: { room: Room }) => void;
  content_submitted: (payload: { phase: string; contentKey: string; room: Room }) => void;
  debate_ended: (payload: { result: DebateResult; room: Room }) => void;
  community_vote_update: (payload: { topicId: number; topic: CommunityTopic }) => void;
  poll_slot_updated: (payload: { slot: string; poll: CommunityTopic }) => void;
  hot_badges_updated: (payload: { topics: CommunityTopic[] }) => void;
  error: (payload: { message: string }) => void;
}
