import type { RequestHandler } from 'express';
import { env } from '../config/env';
import { CSRF_COOKIE } from '../utils/cookies';
import { AppError } from '../utils/errors';
import { safeEqual } from '../utils/tokens';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
// Public endpoints that run before a session exists (protected by the Origin check and SameSite cookies instead).
const PUBLIC_PATHS = new Set(['/auth/login', '/auth/register', '/auth/forgot-password', '/auth/reset-password', '/support/contact']);

/**
 * CSRF defence for cookie authentication:
 * 1. If an Origin header is present it must match WEB_ORIGIN.
 * 2. Authenticated state-changing requests must echo the csrf cookie in the X-CSRF-Token header (double submit).
 */
export const csrfProtection: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();
  const origin = req.get('origin');
  if (origin && origin !== env.WEB_ORIGIN) return next(AppError.forbidden('Cross-origin request blocked.'));
  if (PUBLIC_PATHS.has(req.path)) return next();
  if (req.cookies?.[env.SESSION_COOKIE_NAME]) {
    const cookie = req.cookies[CSRF_COOKIE] as string | undefined;
    const header = req.get('x-csrf-token');
    if (!cookie || !header || !safeEqual(cookie, header)) return next(AppError.forbidden('Missing or invalid CSRF token. Refresh the page and try again.'));
  }
  next();
};
