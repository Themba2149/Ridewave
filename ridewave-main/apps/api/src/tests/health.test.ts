import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

const { queryRaw } = vi.hoisted(() => ({ queryRaw: vi.fn() }));
vi.mock('../config/database', () => ({ prisma: { $queryRaw: queryRaw } }));

import { createApp } from '../app';

describe('GET /api/v1/health', () => {
  it('returns 200 and integration modes when the database is reachable', async () => {
    queryRaw.mockResolvedValueOnce([{ 1: 1 }]);
    const res = await request(createApp()).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ status: 'ok', database: 'up', integrations: { maps: 'dev', payments: 'dev' } });
  });

  it('returns 503 and does not leak internals when the database is down', async () => {
    queryRaw.mockRejectedValueOnce(new Error('secret connection detail'));
    const res = await request(createApp()).get('/api/v1/health');
    expect(res.status).toBe(503);
    expect(res.body.data.database).toBe('down');
    expect(JSON.stringify(res.body)).not.toContain('secret connection detail');
  });
});

describe('error handling', () => {
  it('returns the standard envelope for unknown routes', async () => {
    const res = await request(createApp()).get('/api/v1/nope');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
  });

  it('returns a validation error for malformed JSON', async () => {
    const res = await request(createApp()).post('/api/v1/health').set('Content-Type', 'application/json').send('{bad');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
