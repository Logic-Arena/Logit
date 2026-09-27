import { useCallback, useEffect, useRef } from 'react';
import { socket } from '../lib/socket';

// 임시저장은 최대 1초에 한 번만 전송한다. 키 입력(특히 한글 조합)마다 보내면
// 서버 소켓 요청 한도에 걸려 제출까지 거절될 수 있다.
const DRAFT_SYNC_INTERVAL_MS = 1000;
// 서버는 단계 종료 시각 이후의 임시저장을 버리므로 종료 직전에 마지막 내용을 한 번 더 보낸다.
const DEADLINE_FLUSH_MARGIN_MS = 1000;

export function useDraftSync({ roomId, phase, text, enabled, phaseEndAt }: {
  roomId: string;
  phase: string | undefined;
  text: string;
  enabled: boolean;
  phaseEndAt: number | null;
}) {
  const latest = useRef({ roomId, phase, text, enabled });
  const lastSentAt = useRef(0);
  const lastSent = useRef<string | null>(null);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  const send = useCallback(() => {
    if (pending.current) { clearTimeout(pending.current); pending.current = null; }
    const { roomId, phase, text, enabled } = latest.current;
    if (!enabled || !phase) return;
    const key = `${roomId}\u0000${phase}\u0000${text}`;
    if (key === lastSent.current) return;
    socket.emit('save_draft', { roomId, phase, text });
    lastSent.current = key;
    lastSentAt.current = Date.now();
  }, []);

  // 변경 즉시 보내되 직전 전송 후 1초가 안 지났으면 남은 시간 뒤에 최신 내용만 보낸다.
  useEffect(() => {
    latest.current = { roomId, phase, text, enabled };
    if (!enabled || !phase) return;
    const wait = DRAFT_SYNC_INTERVAL_MS - (Date.now() - lastSentAt.current);
    if (wait <= 0) send();
    else if (!pending.current) pending.current = setTimeout(send, wait);
  }, [roomId, phase, text, enabled, send]);

  useEffect(() => {
    if (!enabled || !phaseEndAt) return;
    const timer = setTimeout(send, Math.max(0, phaseEndAt - Date.now() - DEADLINE_FLUSH_MARGIN_MS));
    return () => clearTimeout(timer);
  }, [enabled, phaseEndAt, send]);

  useEffect(() => () => {
    if (pending.current) clearTimeout(pending.current);
  }, []);
}
