import { io, Socket } from 'socket.io-client';
import { API_URL, getToken } from './api';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket) return socket;
  socket = io(API_URL, {
    transports: ['websocket'],
    auth: { token: getToken() ?? '' },
    autoConnect: true,
  });
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
