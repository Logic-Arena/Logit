import type { ChatMessage as ChatMsg } from '../../types/room';

interface Props {
  message: ChatMsg;
  isMe: boolean;
}

const roleLabel: Record<string, string> = {
  host: '방장',
  participant: '참가자',
  observer: '관전자',
};

const voteLabel: Record<string, string> = {
  pro: '찬성',
  con: '반대',
};

export function ChatMessage({ message, isMe }: Props) {
  const time = new Date(message.timestamp).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const positionClass = message.vote === 'con' ? 'chat-msg--con' : 'chat-msg--pro';
  const colorClass = isMe ? 'chat-msg--mine' : 'chat-msg--theirs';

  return (
    <div className={`chat-msg ${positionClass} ${colorClass}`}>
      <div className="chat-msg__meta">
        <span>{message.username}</span>
        <span className={`badge badge--${message.userRole}`}>{roleLabel[message.userRole]}</span>
        {message.vote && (
          <span className={`badge badge--${message.vote}`}>{voteLabel[message.vote]}</span>
        )}
        <span>{time}</span>
      </div>
      <div className="chat-msg__bubble">{message.content}</div>
    </div>
  );
}
