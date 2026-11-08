import crypto from 'node:crypto';
import { env } from '../config/env';

export const newToken = () => crypto.randomBytes(32).toString('base64url');

/** Tokens are stored only as keyed hashes (HMAC with SESSION_SECRET), so a database leak does not expose usable session or reset tokens. */
export const hashToken = (token: string) => crypto.createHmac('sha256', env.SESSION_SECRET).update(token).digest('hex');

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
