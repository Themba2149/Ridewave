import { describe, expect, it } from 'vitest';
import { loadEnv } from '../config/env';

const base = { DATABASE_URL: 'file:./x.db', SESSION_SECRET: 'x'.repeat(40) };

describe('loadEnv', () => {
  it('applies defaults', () => {
    const e = loadEnv(base as NodeJS.ProcessEnv);
    expect(e.PORT).toBe(4000);
    expect(e.MAP_PROVIDER).toBe('dev');
  });
  it('rejects a short session secret with a readable message', () => {
    expect(() => loadEnv({ ...base, SESSION_SECRET: 'short' } as NodeJS.ProcessEnv)).toThrow(/SESSION_SECRET/);
  });
  it('rejects the placeholder secret in production', () => {
    expect(() => loadEnv({ ...base, NODE_ENV: 'production', SESSION_SECRET: 'replace-me-' + 'x'.repeat(30) } as NodeJS.ProcessEnv)).toThrow(/placeholder/);
  });
  it('requires a key for a live map provider', () => {
    expect(() => loadEnv({ ...base, MAP_PROVIDER: 'mapbox' } as NodeJS.ProcessEnv)).toThrow(/MAP_API_KEY/);
  });
});
