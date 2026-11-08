import type { Server } from 'socket.io';

// The Socket.IO server is attached in server.ts. Until then (and in unit tests) every emit is a harmless no-op.
let io: Server | null = null;
export const setIo = (server: Server | null) => { io = server; };
export const emitToUser = (userId: string, event: string, payload: object) => { io?.to(`user:${userId}`).emit(event, payload); };
export const emitToRide = (rideId: string, event: string, payload: object) => { io?.to(`ride:${rideId}`).emit(event, payload); };
/** Drop live connections for a user (used when their sessions are revoked). */
export const disconnectUser = (userId: string) => { io?.in(`user:${userId}`).disconnectSockets(true); };
