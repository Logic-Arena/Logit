import { useState, useRef, useEffect } from 'react';
import { socket } from '../../lib/socket';
import { useChatStore } from '../../store/useChatStore';
import { ChatMessage } from './ChatMessage';
import type { Phase, UserRole, VoteOption } from '../../types/room';

interface Props {
  roomId: string;
  mySocketId: string;
  myUserId: string;
  phase: Phase;
  myRole: UserRole;
  myVote: VoteOption | null;
  onSend?: (content: string) => void;
}

export function ChatPanel({ roomId, myUserId, phase, myRole, myVote, onSend }: Props) {
  const messages = useChatStore((s) => s.messages);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const isDisabled =
    phase === 'waiting' || myRole === 'observer' || myVote === null;

  const disabledReason =
    phase === 'waiting'
      ? '토론이 시작되면 채팅할 수 있습니다'
      : myRole === 'observer'
        ? '관전자는 채팅할 수 없습니다'
        : '투표 후 채팅 가능합니다';

  const handleSend = () => {
    const content = input.trim();
    if (!content || isDisabled) return;
    if (onSend) {
      onSend(content);
    } else {
      socket.emit('send_message', { roomId, content });
    }
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-panel">
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty">아직 메시지가 없습니다</div>
        ) : (
          messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              isMe={msg.userId === myUserId || false}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-area">
        {isDisabled ? (
          <div className="chat-disabled-msg">{disabledReason}</div>
        ) : (
          <>
            <input
              className="chat-input"
              placeholder="메시지를 입력하세요..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              className="chat-send-btn"
              onClick={handleSend}
              disabled={!input.trim()}
            >
              전송
            </button>
          </>
        )}
      </div>
    </div>
  );
}
