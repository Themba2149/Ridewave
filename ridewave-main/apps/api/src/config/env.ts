import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

// Load the single root-level .env (apps/api/src/config -> repo root).
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const PLACEHOLDER = 'replace-me';

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required, e.g. "file:./dev.db"'),
    SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
    SESSION_COOKIE_NAME: z.string().min(1).default('ridewave.sid'),
    // Private directory for uploaded driver documents. Never served statically.
    STORAGE_DIR: z.string().min(1).default(path.resolve(__dirname, '../../storage')),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    MAP_PROVIDER: z.enum(['dev', 'mapbox', 'google']).default('dev'),
    MAP_API_KEY: z.string().optional().default(''),
    PAYMENT_PROVIDER: z.enum(['dev']).default('dev'),
    PAYMENT_API_KEY: z.string().optional().default(''),
    EMAIL_PROVIDER: z.enum(['dev']).default('dev'),
    EMAIL_API_KEY: z.string().optional().default(''),
  })
  .superRefine((v, ctx) => {
    if (v.NODE_ENV === 'production' && v.SESSION_SECRET.startsWith(PLACEHOLDER)) {
      ctx.addIssue({ code: 'custom', path: ['SESSION_SECRET'], message: 'Replace the placeholder SESSION_SECRET before running in production' });
    }
    if (v.MAP_PROVIDER !== 'dev' && !v.MAP_API_KEY) {
      ctx.addIssue({ code: 'custom', path: ['MAP_API_KEY'], message: `MAP_PROVIDER=${v.MAP_PROVIDER} requires MAP_API_KEY (or set MAP_PROVIDER=dev)` });
    }
  });

export type Env = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`);
    throw new Error(
      `Invalid environment configuration:\n${lines.join('\n')}\n\nFix: copy .env.example to .env (PowerShell: Copy-Item .env.example .env) and set the values above.`,
    );
  }
  return parsed.data;
}

export const env: Env = loadEnv();
