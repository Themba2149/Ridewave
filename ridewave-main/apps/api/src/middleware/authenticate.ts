import type { RequestHandler } from 'express';
import { env } from '../config/env';
import { authRepository as repo } from '../repositories/auth.repository';
import { AppError } from '../utils/errors';
import { hashToken } from '../utils/tokens';

/** Requires a valid, unrevoked, unexpired session for an ACTIVE account. Role is always read from the database, never from the client. */
export const authenticate: RequestHandler = async (req, _res, next) => {
  try {
    const token = req.cookies?.[env.SESSION_COOKIE_NAME] as string | undefined;
    if (!token) throw AppError.unauthenticated();
    const session = await repo.findSessionWithUser(hashToken(token));
    if (!session || session.revokedAt || session.expiresAt.getTime() < Date.now()) throw AppError.unauthenticated('Your session has expired. Please sign in again.');
    if (session.user.status !== 'ACTIVE') throw AppError.forbidden('This account is not active. Please contact support.');
    req.auth = { user: session.user, sessionId: session.id };
    next();
  } catch (err) {
    next(err);
  }
};
