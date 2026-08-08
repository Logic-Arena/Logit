import { useEffect, useRef, useState } from 'react';
import { useChatStore } from '../../store/useChatStore';
import { ChatMessage } from './ChatMessage';
import type { Phase, PlayerRole, VoteOption } from '../../types/room';

interface Props {
  roomId: string;
  mySocketId: string;
  myUserId: string;
  phase: Phase;
  myRole: PlayerRole;
  myVote: VoteOption | null;
  onSend?: (content: string) => void;
}

export function ChatPanel({ myUserId, phase, myRole, onSend }: Props) {
  const messages = useChatStore((s) => s.messages);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const isDisabled = phase === 'waiting' || myRole === 'observer' || !onSend;

  const handleSend = () => {
    const content = input.trim();
    if (!content || isDisabled || !onSend) return;
    onSend(content);
    setInput('');
  };

  return (
    <div className="chat-panel">
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty">아직 메시지가 없습니다.</div>
        ) : (
          messages.map((message) => (
            <ChatMessage key={message.id} message={message} isMe={message.userId === myUserId} />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-area">
        {isDisabled ? (
          <div className="chat-disabled-msg">현재 이 패널은 비활성화되어 있습니다.</div>
        ) : (
          <>
            <input
              className="chat-input"
              placeholder="메시지를 입력해 주세요."
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleSend();
                }
              }}
            />
            <button className="chat-send-btn" onClick={handleSend} disabled={!input.trim()}>
              전송
            </button>
          </>
        )}
      </div>
    </div>
  );
}
