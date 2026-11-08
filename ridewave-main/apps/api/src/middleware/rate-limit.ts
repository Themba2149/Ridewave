import type { Response } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

const handler = (_req: unknown, res: Response) => {
  res.status(429).json({ success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests. Please wait a moment and try again.' } });
};

const skip = () => env.NODE_ENV === 'test';

/** General API limiter. */
export const apiLimiter = rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false, handler, skip });

/** Stricter limiter for login, registration and password reset (applied in Phase 3). */
export const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false, handler, skip });

/** Public contact form: a handful of messages per visitor per 15 minutes. */
export const contactLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 5, standardHeaders: 'draft-7', legacyHeaders: false, handler, skip });

/** Document uploads: a modest number per driver per hour. */
export const uploadLimiter = rateLimit({ windowMs: 60 * 60_000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false, handler, skip });
