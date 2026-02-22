import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../lib/socket';
import { useRoomStore } from '../store/useRoomStore';
import { useChatStore } from '../store/useChatStore';
import { useToast } from './useToast';
import type { Room, RoomUser, ChatMessage } from '../types/room';

export function useRoomEvents() {
  const { setRoom, updateRoom, setPhase, setVoteTally } = useRoomStore();
  const { addMessage, clearMessages } = useChatStore();
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    const onRoomState = ({ room }: { room: Room }) => {
      setRoom(room);
      clearMessages();
    };

    const onUserJoined = ({ room }: { user: RoomUser; room: Room }) => {
      updateRoom(room);
    };

    const onUserLeft = ({ room }: { user: RoomUser; room: Room | null }) => {
      if (room === null) {
        navigate('/');
        return;
      }
      updateRoom(room);
    };

    const onHostChanged = () => {
      toast('방장이 변경되었습니다');
    };

    const onDebateStarted = ({ topic, phase }: { topic: string; phase: 'voting' }) => {
      setPhase(phase, topic);
    };

    const onVoteUpdated = (tally: { pro: number; con: number }) => {
      setVoteTally(tally);
    };

    const onNewMessage = ({ message }: { message: ChatMessage }) => {
      addMessage(message);
    };

    const onError = ({ message }: { message: string }) => {
      toast(message, 'error');
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = socket as any;
    s.on('room_state', onRoomState);
    s.on('user_joined', onUserJoined);
    s.on('user_left', onUserLeft);
    s.on('host_changed', onHostChanged);
    s.on('debate_started', onDebateStarted);
    s.on('vote_updated', onVoteUpdated);
    s.on('new_message', onNewMessage);
    s.on('error', onError);

    return () => {
      s.off('room_state', onRoomState);
      s.off('user_joined', onUserJoined);
      s.off('user_left', onUserLeft);
      s.off('host_changed', onHostChanged);
      s.off('debate_started', onDebateStarted);
      s.off('vote_updated', onVoteUpdated);
      s.off('new_message', onNewMessage);
      s.off('error', onError);
    };
  }, [setRoom, updateRoom, setPhase, setVoteTally, addMessage, clearMessages, navigate, toast]);
}
