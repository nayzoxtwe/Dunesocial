import type { Server } from 'socket.io';

let io: Server | null = null;

export function registerSocket(server: Server) {
  io = server;
}

export function getSocket() {
  return io;
}

export function emitToConversation(conversationId: string, event: string, payload: unknown) {
  io?.to(`conversation:${conversationId}`).emit(event, payload);
}

export function emitToUser(userId: string, event: string, payload: unknown) {
  io?.to(`user:${userId}`).emit(event, payload);
}

export function broadcast(event: string, payload: unknown) {
  io?.emit(event, payload);
}
