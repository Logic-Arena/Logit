import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '../types/socket';

const API_URL = import.meta.env.VITE_API_URL ?? '/api';
const SOCKET_URL = API_URL.startsWith('http') ? API_URL : undefined;

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(SOCKET_URL, {
  autoConnect: false,
});
