import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../lib/socket';
import { useRoomStore } from '../store/useRoomStore';
import { useDebateHistoryStore } from '../store/useDebateHistoryStore';
import { useToast } from './useToast';
import { useUserStore } from '../store/useUserStore';
import { getMe } from '../lib/api';
import type { Room, DebateResult, PlayerRole } from '../types/room';

export function useRoomEvents() {
  const { setRoom, updateRoom, setDebateResult } = useRoomStore();
  const addHistory = useDebateHistoryStore((s) => s.addHistory);
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = socket as any;

    const onRoomState = ({ room, myRole }: { room: Room; myRole: PlayerRole }) =>
      setRoom(room, myRole);

    const onPlayerJoined = ({ room }: { room: Room }) => updateRoom(room);

    const onPlayerLeft = ({ room }: { room: Room | null }) => {
      if (!room) { navigate('/'); return; }
      updateRoom(room);
    };

    const onPhaseChanged = ({ room }: { phase: string; room: Room }) => updateRoom(room);

    const onTopicSet = ({ room }: { topic: string; room: Room }) => updateRoom(room);

    const onSidesAssigned = ({ random, room }: { random: boolean; room: Room }) => {
      updateRoom(room);
      if (random) toast('같은 진영을 3번 선택하여 무작위로 배정되었습니다', 'info');
    };

    const onSideSelectionUpdate = ({ room }: { room: Room }) => updateRoom(room);

    const onSideSelectionRetry = ({ attempts, room }: { attempts: number; room: Room }) => {
      updateRoom(room);
      toast(`두 분이 같은 진영을 선택했습니다. 다시 선택해 주세요. (${attempts}/3)`, 'info');
    };

    const onAiContent = ({ room }: { room: Room }) => updateRoom(room);

    const onContentSubmitted = ({ room }: { room: Room }) => updateRoom(room);

    const onDebateEnded = ({ result, room }: { result: DebateResult; room: Room }) => {
      updateRoom(room);
      setDebateResult(result);
      addHistory({
        id: `${room.id}-${Date.now()}`,
        roomId: room.id,
        roomTitle: room.title,
        topic: room.topic,
        endedAt: new Date().toISOString(),
        winner: result.winner,
        summary: result.summary,
        mySide:
          room.proPlayer?.socketId === socket.id
            ? 'pro'
            : room.conPlayer?.socketId === socket.id
              ? 'con'
              : null,
        result,
      });
      const { user, setUser } = useUserStore.getState();
      if (user) { getMe().then(setUser).catch(() => {}); }
    };

    const onError = ({ message }: { message: string }) => toast(message, 'error');

    s.on('room_state', onRoomState);
    s.on('player_joined', onPlayerJoined);
    s.on('player_left', onPlayerLeft);
    s.on('phase_changed', onPhaseChanged);
    s.on('topic_set', onTopicSet);
    s.on('sides_assigned', onSidesAssigned);
    s.on('side_selection_update', onSideSelectionUpdate);
    s.on('side_selection_retry', onSideSelectionRetry);
    s.on('ai_content', onAiContent);
    s.on('content_submitted', onContentSubmitted);
    s.on('debate_ended', onDebateEnded);
    s.on('error', onError);

    return () => {
      s.off('room_state', onRoomState);
      s.off('player_joined', onPlayerJoined);
      s.off('player_left', onPlayerLeft);
      s.off('phase_changed', onPhaseChanged);
      s.off('topic_set', onTopicSet);
      s.off('sides_assigned', onSidesAssigned);
      s.off('side_selection_update', onSideSelectionUpdate);
      s.off('side_selection_retry', onSideSelectionRetry);
      s.off('ai_content', onAiContent);
      s.off('content_submitted', onContentSubmitted);
      s.off('debate_ended', onDebateEnded);
      s.off('error', onError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
