import cookie from 'cookie';
import type http from 'node:http';
import { Server } from 'socket.io';
import { env } from '../config/env';
import { authRepository } from '../repositories/auth.repository';
import { ridesRepository } from '../repositories/rides.repository';
import { setIo } from '../services/realtime.service';
import { hashToken } from '../utils/tokens';
import { logger } from '../utils/logger';

type Session = NonNullable<Awaited<ReturnType<typeof authRepository.findSessionWithUser>>>;
const valid = (s: Session | null): s is Session => !!s && !s.revokedAt && s.expiresAt.getTime() > Date.now() && s.user.status === 'ACTIVE';

/**
 * Real-time channel. Connections are authenticated with the same HTTP-only session cookie as the REST API, and the browser's Origin
 * must match WEB_ORIGIN (blocks cross-site WebSocket hijacking). A user automatically joins only their own room; ride rooms are
 * joined on request after the server checks the user is a participant. Events carry no ride data: clients re-fetch over REST.
 */
export function attachRealtime(server: http.Server): Server {
  const io = new Server(server, { cors: { origin: env.WEB_ORIGIN, credentials: true }, serveClient: false });

  io.use(async (socket, next) => {
    try {
      const origin = socket.handshake.headers.origin;
      if (origin && origin !== env.WEB_ORIGIN) return next(new Error('forbidden'));
      const token = cookie.parse(socket.handshake.headers.cookie ?? '')[env.SESSION_COOKIE_NAME];
      if (!token) return next(new Error('unauthorized'));
      const tokenHash = hashToken(token);
      const session = await authRepository.findSessionWithUser(tokenHash);
      if (!valid(session)) return next(new Error('unauthorized'));
      socket.data.userId = session.user.id;
      socket.data.role = session.user.role;
      socket.data.tokenHash = tokenHash;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    void socket.join(`user:${socket.data.userId as string}`);

    socket.on('ride:subscribe', async (rideId: unknown, ack?: (r: { ok: boolean }) => void) => {
      const reply = (ok: boolean) => { if (typeof ack === 'function') ack({ ok }); };
      try {
        if (typeof rideId !== 'string' || rideId.length === 0 || rideId.length > 64) return reply(false);
        if (!valid(await authRepository.findSessionWithUser(socket.data.tokenHash as string))) { socket.disconnect(true); return; } // session ended since connecting
        const ride = await ridesRepository.getRideDetail(rideId);
        const uid = socket.data.userId as string;
        const allowed = !!ride && (socket.data.role === 'ADMIN' || ride.passengerUserId === uid || ride.driverUserId === uid);
        if (!allowed) return reply(false); // same answer for "does not exist" and "not yours"
        await socket.join(`ride:${rideId}`);
        reply(true);
      } catch (err) {
        logger.warn({ err }, 'ride:subscribe failed');
        reply(false);
      }
    });
    socket.on('ride:unsubscribe', (rideId: unknown) => { if (typeof rideId === 'string') void socket.leave(`ride:${rideId}`); });
  });

  setIo(io);
  return io;
}
