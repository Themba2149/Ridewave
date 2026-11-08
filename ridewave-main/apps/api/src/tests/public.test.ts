import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findMany, create } = vi.hoisted(() => ({ findMany: vi.fn(), create: vi.fn() }));
vi.mock('../config/database', () => ({
  prisma: { $queryRaw: vi.fn(), rideCategory: { findMany }, supportTicket: { create } },
}));

import { createApp } from '../app';

beforeEach(() => {
  findMany.mockReset();
  create.mockReset();
});

describe('GET /api/v1/ride-categories', () => {
  it('returns active categories with their demonstration rates and skips categories without a fare configuration', async () => {
    findMany.mockResolvedValueOnce([
      { code: 'ECONOMY', name: 'RideWave Economy', description: 'd', capacity: 4, luggageNote: null,
        fareConfigurations: [{ currency: 'ZAR', baseFareMinor: 1500, perKmMinor: 750, perMinuteMinor: 900, minimumFareMinor: 3000, bookingFeeMinor: 500 }] },
      { code: 'NOFARE', name: 'x', description: 'd', capacity: 4, luggageNote: null, fareConfigurations: [] },
    ]);
    const res = await request(createApp()).get('/api/v1/ride-categories');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ code: 'ECONOMY', minimumFareMinor: 3000, currency: 'ZAR' });
  });

  it('returns the standard error envelope when the database fails', async () => {
    findMany.mockRejectedValueOnce(new Error('db exploded'));
    const res = await request(createApp()).get('/api/v1/ride-categories');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });
});

describe('POST /api/v1/support/contact', () => {
  const valid = { name: 'Thandi', email: 'Thandi@Example.com', subject: 'Question', message: 'How do I become a driver?' };

  it('stores a ticket with a normalised email', async () => {
    create.mockResolvedValueOnce({ id: 't1' });
    const res = await request(createApp()).post('/api/v1/support/contact').send(valid);
    expect(res.status).toBe(201);
    expect(res.body.data.ticketId).toBe('t1');
    expect(create.mock.calls[0]?.[0].data.email).toBe('thandi@example.com');
  });

  it('rejects invalid input with field-level details and saves nothing', async () => {
    const res = await request(createApp()).post('/api/v1/support/contact').send({ ...valid, email: 'nope', message: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d: { path: string }) => d.path).sort()).toEqual(['email', 'message']);
    expect(create).not.toHaveBeenCalled();
  });
});
