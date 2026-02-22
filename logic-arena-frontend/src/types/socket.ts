import type { Room, RoomUser, ChatMessage, VoteOption } from './room';

export interface ClientToServerEvents {
  join_room: (payload: {
    roomId: string;
    userId: string;
    username: string;
    userRole: 'host' | 'participant' | 'observer';
  }) => void;
  leave_room: (payload: { roomId: string }) => void;
  start_debate: (payload: { roomId: string }) => void;
  cast_vote: (payload: { roomId: string; vote: VoteOption }) => void;
  send_message: (payload: { roomId: string; content: string }) => void;
}

export interface ServerToClientEvents {
  room_list: (rooms: Room[]) => void;
  room_state: (payload: { room: Room }) => void;
  user_joined: (payload: { user: RoomUser; room: Room }) => void;
  user_left: (payload: { user: RoomUser; room: Room }) => void;
  host_changed: (payload: { newHostSocketId: string }) => void;
  debate_started: (payload: { topic: string; phase: 'voting' }) => void;
  vote_updated: (payload: { pro: number; con: number }) => void;
  new_message: (payload: { message: ChatMessage }) => void;
  error: (payload: { message: string }) => void;
}
