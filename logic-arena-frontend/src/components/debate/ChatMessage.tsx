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

export function ChatMessage({ message, isMe }: Props) {
  const time = new Date(message.timestamp).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={`chat-msg chat-msg--${isMe ? 'me' : 'other'}`}>
      <div className="chat-msg__meta">
        <span>{message.username}</span>
        <span className={`badge badge--${message.userRole}`}>{roleLabel[message.userRole]}</span>
        <span>{time}</span>
      </div>
      <div className="chat-msg__bubble">{message.content}</div>
    </div>
  );
}
