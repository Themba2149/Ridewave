import type { Response } from 'express';
import { env } from '../config/env';

export const CSRF_COOKIE = 'ridewave.csrf';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const base = { sameSite: 'lax' as const, secure: env.NODE_ENV === 'production', path: '/', maxAge: SESSION_TTL_MS };

export function setAuthCookies(res: Response, sessionToken: string, csrfToken: string) {
  res.cookie(env.SESSION_COOKIE_NAME, sessionToken, { ...base, httpOnly: true });
  // Readable by the frontend on purpose: it echoes this value in the X-CSRF-Token header (double-submit pattern).
  res.cookie(CSRF_COOKIE, csrfToken, { ...base, httpOnly: false });
}

export function clearAuthCookies(res: Response) {
  const { maxAge: _m, ...opts } = base;
  void _m;
  res.clearCookie(env.SESSION_COOKIE_NAME, { ...opts, httpOnly: true });
  res.clearCookie(CSRF_COOKIE, { ...opts, httpOnly: false });
}
