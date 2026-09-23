import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '../types/socket';
import { useUserStore } from '../store/useUserStore';

const API_URL = import.meta.env.VITE_API_URL ?? '/api';
const SOCKET_URL = API_URL.startsWith('http') ? API_URL : undefined;

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(SOCKET_URL, {
  autoConnect: false,
  auth: (callback) => callback({ token: useUserStore.getState().token }),
});

useUserStore.subscribe((state, previous) => {
  if (state.token === previous.token) return;
  const connected = socket.connected;
  socket.disconnect();
  if (state.token && connected) socket.connect();
});

socket.on('connect_error', (error) => {
  if ((error as Error & { data?: { code?: string } }).data?.code === 'UNAUTHORIZED') useUserStore.getState().logout();
});

socket.on('disconnect', (reason) => {
  if (reason === 'io server disconnect') useUserStore.getState().logout();
});
