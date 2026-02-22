import { useEffect } from 'react';
import { socket } from '../lib/socket';
import { useRoomStore } from '../store/useRoomStore';

export function useSocket() {
  const setMySocketId = useRoomStore((s) => s.setMySocketId);

  useEffect(() => {
    const onConnect = () => setMySocketId(socket.id ?? '');
    socket.on('connect', onConnect);
    return () => {
      socket.off('connect', onConnect);
    };
  }, [setMySocketId]);

  return socket;
}
