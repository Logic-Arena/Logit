import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { socket } from '../lib/socket';
import { useSocket } from '../hooks/useSocket';
import { useRoomEvents } from '../hooks/useRoomEvents';
import { useRoomStore } from '../store/useRoomStore';
import { useUserStore } from '../store/useUserStore';
import { useToast } from '../hooks/useToast';

import { TopicBanner } from '../components/debate/TopicBanner';
import { UserList } from '../components/debate/UserList';
import { VoteModal } from '../components/debate/VoteModal';
import { HostControls } from '../components/debate/HostControls';
import { ChatPanel } from '../components/debate/ChatPanel';
import type { UserRole } from '../types/room';

interface LocationState {
  requestedRole?: 'participant' | 'observer';
}

export function DebatePage() {
  const { roomId } = useParams<{ roomId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();

  const { userId, username } = useUserStore();
  const { room, mySocketId, resetRoom } = useRoomStore();
  const didJoin = useRef(false);
  const [isVoteModalOpen, setIsVoteModalOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Set up socket id tracking
  useSocket();

  // Register server→client event listeners
  useRoomEvents();

  useEffect(() => {
    if (!roomId || !username) {
      navigate(`/rooms/${roomId}`, { replace: true });
      return;
    }

    const { requestedRole = 'participant' } = (location.state as LocationState) ?? {};
    const userRole: UserRole = requestedRole === 'observer' ? 'observer' : 'host';

    socket.connect();

    const onConnect = () => {
      if (didJoin.current) return;
      didJoin.current = true;
      socket.emit('join_room', { roomId, userId, username, userRole });
    };

    socket.on('connect', onConnect);

    // If already connected when this effect runs
    if (socket.connected && !didJoin.current) {
      didJoin.current = true;
      socket.emit('join_room', { roomId, userId, username, userRole });
    }

    return () => {
      socket.off('connect', onConnect);
      if (roomId) socket.emit('leave_room', { roomId });
      resetRoom();
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Detect role demotion after room_state received
  const prevRequestedRole = useRef<string | null>(null);
  useEffect(() => {
    if (!room || !mySocketId) return;
    const { requestedRole = 'participant' } = (location.state as LocationState) ?? {};
    if (prevRequestedRole.current !== null) return;
    prevRequestedRole.current = requestedRole;

    const myUser = room.users[mySocketId];
    if (!myUser) return;

    if (
      (requestedRole === 'participant' || requestedRole === 'observer') &&
      myUser.userRole === 'observer' &&
      requestedRole !== 'observer'
    ) {
      toast('참가자 정원이 가득 차 관전자로 배정되었습니다', 'info');
    }
  }, [room, mySocketId, location.state, toast]);

  // Auto-open vote modal when phase transitions to 'voting'
  useEffect(() => {
    if (room?.phase === 'voting') {
      setIsVoteModalOpen(true);
    }
  }, [room?.phase]);

  // Re-open vote modal when AI resets the topic (topic_updated event)
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = socket as any;
    const onTopicUpdated = () => setIsVoteModalOpen(true);
    s.on('topic_updated', onTopicUpdated);
    return () => s.off('topic_updated', onTopicUpdated);
  }, []);

  if (!room) {
    return <div className="loading">방에 접속 중...</div>;
  }

  const myUser = mySocketId ? room.users[mySocketId] : null;
  const myRole = myUser?.userRole ?? 'observer';
  const myVote = myUser?.vote ?? null;

  const isHost = myRole === 'host';
  const isObserver = myRole === 'observer';
  const showHostControls = isHost && room.phase === 'waiting';
  const showReopenVoteButton = !isObserver && room.phase === 'voting' && !isVoteModalOpen;
  const showTopicBanner = room.phase === 'voting' && room.topic;

  const isAiMode = room.mode === 'ai_debate';

  return (
    <div className="debate-page">
      {/* Vote Modal */}
      {!isObserver && (
        <VoteModal
          roomId={room.id}
          topic={room.topic}
          myVote={myVote}
          isOpen={isVoteModalOpen}
          onClose={() => setIsVoteModalOpen(false)}
        />
      )}

      {/* Sidebar backdrop (mobile only) */}
      <div
        className={`sidebar-backdrop${sidebarOpen ? ' is-open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <div className={`debate-sidebar${sidebarOpen ? ' is-open' : ''}`}>
        {isAiMode && (
          <div className="ai-mode-indicator">
            <span className="ai-mode-indicator__dot" />
            AI 대전 모드
          </div>
        )}
        <UserList room={room} mySocketId={mySocketId} />

        {showReopenVoteButton && (
          <div className="vote-reopen">
            <button
              className="vote-reopen__btn"
              onClick={() => setIsVoteModalOpen(true)}
            >
              {myVote ? '투표 결과 보기' : '투표하기'}
            </button>
          </div>
        )}

        {showHostControls && (
          <HostControls roomId={room.id} />
        )}
      </div>

      {/* Main */}
      <div className="debate-main">
        {/* Mobile Header (사이드바 토글 + 주제 미리보기) */}
        <div className="debate-mobile-header">
          <button
            className="sidebar-toggle-btn"
            onClick={() => setSidebarOpen(v => !v)}
          >
            참가자{Object.keys(room.users).length}명
          </button>
          {showTopicBanner && (
            <span className="debate-mobile-header__topic">{room.topic}</span>
          )}
        </div>

        {/* Mobile Participants Strip */}
        <div className="mobile-participants-strip">
          {Object.entries(room.users)
            .filter(([, u]) => u.userRole !== 'observer')
            .map(([socketId, user]) => {
              const vote = room.phase === 'voting' ? user.vote : null;
              const isMe = socketId === mySocketId;
              return (
                <span
                  key={socketId}
                  className={[
                    'participant-chip',
                    vote ? `participant-chip--${vote}` : '',
                    isMe ? 'participant-chip--me' : '',
                  ].filter(Boolean).join(' ')}
                >
                  {isMe ? `나 (${user.username})` : user.username}
                </span>
              );
            })}
        </div>

        {showTopicBanner && <TopicBanner topic={room.topic!} />}
        <ChatPanel
          roomId={room.id}
          mySocketId={mySocketId}
          myUserId={userId}
          phase={room.phase}
          myRole={myRole}
          myVote={myVote}
        />
      </div>
    </div>
  );
}
