import type { ChatMessage as ChatMessageType } from '../../types/room';

interface Props {
  message: ChatMessageType;
  isMe: boolean;
}

const roleLabel = {
  host: '방장',
  participant: '참가자',
  observer: '관전자',
  ai: 'AI',
};

export function ChatMessage({ message, isMe }: Props) {
  const time = new Date(message.timestamp).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const positionClass = message.vote === 'con' ? 'chat-msg--con' : 'chat-msg--pro';
  const colorClass = isMe ? 'chat-msg--mine' : message.userRole === 'ai' ? 'chat-msg--ai' : 'chat-msg--theirs';

  return (
    <div className={`chat-msg ${positionClass} ${colorClass}`}>
      <div className="chat-msg__meta">
        <span>{message.username}</span>
        <span className={`badge badge--${message.userRole === 'participant' ? 'participant' : message.userRole}`}>{roleLabel[message.userRole]}</span>
        {message.vote && <span className={`badge badge--${message.vote}`}>{message.vote === 'pro' ? '찬성' : '반대'}</span>}
        <span>{time}</span>
      </div>
      <div className="chat-msg__bubble">{message.content}</div>
    </div>
  );
}
