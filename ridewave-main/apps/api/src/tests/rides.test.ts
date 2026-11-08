import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authWorld } from './helpers/fake-auth-repository';
import { world } from './helpers/fake-rides-repository';

vi.mock('../config/database', () => ({ prisma: { $queryRaw: vi.fn() } }));
vi.mock('../repositories/auth.repository', async () => ({ authRepository: (await import('./helpers/fake-auth-repository')).authWorld.repo }));
vi.mock('../repositories/rides.repository', async () => ({ ridesRepository: (await import('./helpers/fake-rides-repository')).world.ridesRepo }));
vi.mock('../repositories/drivers.repository', async () => ({ driversRepository: (await import('./helpers/fake-rides-repository')).world.driversRepo }));

import { createApp } from '../app';
import { hashPassword } from '../utils/password';

const app = createApp();
const PASSWORD = 'Sunrise2026x';
const sandton = { address: 'Sandton City, Rivonia Rd, Sandton', lat: -26.1076, lng: 28.0567 };
const airport = { address: 'OR Tambo International Airport, Kempton Park', lat: -26.1337, lng: 28.242 };
const rosebank = { address: 'The Zone @ Rosebank, Oxford Rd, Rosebank', lat: -26.145, lng: 28.0408 };
const trip = { pickup: sandton, dropoff: airport, categoryCode: 'ECONOMY', idempotencyKey: 'key-0001-abcd' };

beforeEach(() => {
  for (const arr of [authWorld.users, authWorld.sessions, authWorld.resets]) arr.length = 0;
  world.reset();
});

async function signUp(email: string, role: 'PASSENGER' | 'DRIVER' = 'PASSENGER') {
  const agent = request.agent(app);
  const res = await agent.post('/api/v1/auth/register').send({ role, fullName: email, email, password: PASSWORD });
  const raw = ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith('ridewave.csrf='))!;
  const csrf = decodeURIComponent(raw.split(';')[0]!.split('=')[1]!);
  const post = (url: string, body: object) => agent.post(url).set('X-CSRF-Token', csrf).send(body);
  const del = (url: string) => agent.delete(url).set('X-CSRF-Token', csrf);
  return { agent, post, del, userId: authWorld.users.find((u) => u.email === email)!.id };
}
async function admin() {
  const u = await authWorld.repo.createUserWithProfile({ email: 'boss@example.com', phone: null, fullName: 'Boss', passwordHash: await hashPassword(PASSWORD), role: 'PASSENGER' });
  u.role = 'ADMIN';
  const agent = request.agent(app);
  await agent.post('/api/v1/auth/login').send({ email: 'boss@example.com', password: PASSWORD });
  return agent;
}

describe('POST /rides/estimate', () => {
  it('returns server-calculated fares for every category, labelled as an estimate from a non-live route', async () => {
    const p = await signUp('p@example.com');
    const res = await p.post('/api/v1/rides/estimate', { pickup: sandton, dropoff: airport });
    expect(res.status).toBe(200);
    expect(res.body.data.isEstimate).toBe(true);
    expect(res.body.data.route).toMatchObject({ source: 'dev-sample', isLive: false });
    expect(res.body.data.options.map((o: { code: string }) => o.code)).toEqual(['ECONOMY', 'COMFORT', 'XL']);
    const [eco, comfort] = res.body.data.options;
    expect(eco.fare.totalMinor).toBeGreaterThan(0);
    expect(comfort.fare.totalMinor).toBeGreaterThan(eco.fare.totalMinor);
  });
  it('rejects client-supplied fares, out-of-area and too-close trips', async () => {
    const p = await signUp('p@example.com');
    expect((await p.post('/api/v1/rides/estimate', { pickup: sandton, dropoff: airport, fare: 1 })).status).toBe(400);
    expect((await p.post('/api/v1/rides/estimate', { pickup: sandton, dropoff: { address: 'Cape Town', lat: -33.92, lng: 18.42 } })).status).toBe(400);
    expect((await p.post('/api/v1/rides/estimate', { pickup: sandton, dropoff: { ...sandton, lat: sandton.lat + 0.0001 } })).status).toBe(400);
  });
  it('is passenger-only', async () => {
    const d = await signUp('d@example.com', 'DRIVER');
    expect((await d.post('/api/v1/rides/estimate', { pickup: sandton, dropoff: airport })).status).toBe(403);
    expect((await request(app).post('/api/v1/rides/estimate').send({ pickup: sandton, dropoff: airport })).status).toBe(401);
  });
});

describe('POST /rides', () => {
  it('saves the ride with a backend-recalculated fare and an auditable status history', async () => {
    const p = await signUp('p@example.com');
    const est = await p.post('/api/v1/rides/estimate', { pickup: sandton, dropoff: airport });
    const res = await p.post('/api/v1/rides', trip);
    expect(res.status).toBe(201);
    const ride = res.body.data.ride;
    expect(ride.status).toBe('SEARCHING_FOR_DRIVER');
    expect(ride.estimatedFareMinor).toBe(est.body.data.options[0].fare.totalMinor);
    expect(ride.statusHistory.map((h: { toStatus: string }) => h.toStatus)).toEqual(['REQUESTED', 'SEARCHING_FOR_DRIVER']);
    expect(JSON.stringify(res.body)).not.toMatch(/passengerUserId|driverUserId/);
  });
  it('ignores any fare the client tries to send', async () => {
    const p = await signUp('p@example.com');
    expect((await p.post('/api/v1/rides', { ...trip, estimatedFareMinor: 1 })).status).toBe(400);
  });
  it('is idempotent: repeating the same submission returns the same ride, not a second booking', async () => {
    const p = await signUp('p@example.com');
    const a = await p.post('/api/v1/rides', trip);
    const b = await p.post('/api/v1/rides', trip);
    expect(b.status).toBe(200);
    expect(b.body.data.duplicate).toBe(true);
    expect(b.body.data.ride.id).toBe(a.body.data.ride.id);
    expect(world.rides).toHaveLength(1);
  });
  it('blocks a second active ride and says which one is active', async () => {
    const p = await signUp('p@example.com');
    const first = await p.post('/api/v1/rides', trip);
    const second = await p.post('/api/v1/rides', { ...trip, idempotencyKey: 'key-0002-abcd' });
    expect(second.status).toBe(409);
    expect(second.body.error.details.rideId).toBe(first.body.data.ride.id);
  });
  it('rejects unknown categories', async () => {
    const p = await signUp('p@example.com');
    expect((await p.post('/api/v1/rides', { ...trip, categoryCode: 'HELICOPTER' })).status).toBe(400);
  });
});

describe('ride access', () => {
  it('lets the passenger and an admin view the ride, and hides it from other passengers', async () => {
    const a = await signUp('a@example.com');
    const b = await signUp('b@example.com');
    const id = (await a.post('/api/v1/rides', trip)).body.data.ride.id;
    expect((await a.agent.get(`/api/v1/rides/${id}`)).status).toBe(200);
    expect((await b.agent.get(`/api/v1/rides/${id}`)).status).toBe(404);
    expect((await (await admin()).get(`/api/v1/rides/${id}`)).status).toBe(200);
    expect((await request(app).get(`/api/v1/rides/${id}`)).status).toBe(401);
  });
  it('lists only the caller’s own rides, filtered by scope', async () => {
    const a = await signUp('a@example.com');
    const b = await signUp('b@example.com');
    await a.post('/api/v1/rides', trip);
    const mine = await a.agent.get('/api/v1/passengers/me/rides?scope=active');
    expect(mine.body.data.total).toBe(1);
    expect((await b.agent.get('/api/v1/passengers/me/rides')).body.data.total).toBe(0);
    expect((await a.agent.get('/api/v1/passengers/me/rides?scope=past')).body.data.total).toBe(0);
  });
});

describe('cancellation rules', () => {
  it('cancels a searching ride for free and records who cancelled', async () => {
    const p = await signUp('p@example.com');
    const id = (await p.post('/api/v1/rides', trip)).body.data.ride.id;
    const res = await p.post(`/api/v1/rides/${id}/cancel`, { reason: 'Changed my mind' });
    expect(res.status).toBe(200);
    expect(res.body.data.cancellationFeeMinor).toBe(0);
    expect(res.body.data.ride).toMatchObject({ status: 'CANCELLED', cancelledBy: 'PASSENGER', cancellationReason: 'Changed my mind' });
    // frees the passenger to book again
    expect((await p.post('/api/v1/rides', { ...trip, idempotencyKey: 'key-0003-abcd' })).status).toBe(201);
  });
  it('cannot cancel twice or cancel someone else’s ride', async () => {
    const a = await signUp('a@example.com');
    const b = await signUp('b@example.com');
    const id = (await a.post('/api/v1/rides', trip)).body.data.ride.id;
    expect((await b.post(`/api/v1/rides/${id}/cancel`, {})).status).toBe(404);
    expect((await a.post(`/api/v1/rides/${id}/cancel`, {})).status).toBe(200);
    expect((await a.post(`/api/v1/rides/${id}/cancel`, {})).status).toBe(409);
  });
  it('charges the cancellation fee only after a driver ACCEPTED and the free window passed', async () => {
    const accept = (r: (typeof world.rides)[number], status: 'DRIVER_ASSIGNED' | 'DRIVER_ARRIVING', acceptedSecondsAgo: number) => {
      r.status = status;
      r.assignedAt = new Date(Date.now() - 600_000);
      if (status === 'DRIVER_ARRIVING') r.statusHistory.push({ fromStatus: 'DRIVER_ASSIGNED', toStatus: 'DRIVER_ARRIVING', actorType: 'DRIVER', note: null, createdAt: new Date(Date.now() - acceptedSecondsAgo * 1000) });
    };
    const a = await signUp('a@example.com');
    const idA = (await a.post('/api/v1/rides', trip)).body.data.ride.id;
    accept(world.rides[0]!, 'DRIVER_ASSIGNED', 0); // offered but not accepted: always free
    expect((await a.post(`/api/v1/rides/${idA}/cancel`, {})).body.data.cancellationFeeMinor).toBe(0);

    const b = await signUp('b@example.com');
    const idB = (await b.post('/api/v1/rides', trip)).body.data.ride.id;
    accept(world.rides.find((r) => r.id === idB)!, 'DRIVER_ARRIVING', 30); // accepted 30 s ago: inside the 120 s free window
    expect((await b.post(`/api/v1/rides/${idB}/cancel`, {})).body.data.cancellationFeeMinor).toBe(0);

    const c = await signUp('c@example.com');
    const idC = (await c.post('/api/v1/rides', trip)).body.data.ride.id;
    accept(world.rides.find((r) => r.id === idC)!, 'DRIVER_ARRIVING', 600); // accepted 10 min ago
    const paid = await c.post(`/api/v1/rides/${idC}/cancel`, {});
    expect(paid.body.data.cancellationFeeMinor).toBe(2000);
    expect(paid.body.data.ride.finalFareMinor).toBe(2000);
  });
  it('refuses to cancel a trip that is already in progress or completed', async () => {
    const p = await signUp('p@example.com');
    const id = (await p.post('/api/v1/rides', trip)).body.data.ride.id;
    world.rides[0]!.status = 'IN_PROGRESS';
    expect((await p.post(`/api/v1/rides/${id}/cancel`, {})).status).toBe(409);
    world.rides[0]!.status = 'COMPLETED';
    expect((await p.post(`/api/v1/rides/${id}/cancel`, {})).status).toBe(409);
  });
});

describe('receipts and reviews', () => {
  async function completedRide() {
    const p = await signUp('p@example.com');
    const id = (await p.post('/api/v1/rides', trip)).body.data.ride.id;
    const r = world.rides[0]!;
    r.status = 'COMPLETED'; r.completedAt = new Date(); r.finalFareMinor = r.estimatedFareMinor; r.driverUserId = 'driver-1';
    return { p, id };
  }
  it('issues an itemised receipt only for completed rides, and only to the passenger', async () => {
    const p = await signUp('p@example.com');
    const id = (await p.post('/api/v1/rides', trip)).body.data.ride.id;
    expect((await p.agent.get(`/api/v1/rides/${id}/receipt`)).status).toBe(409);
    world.rides[0]!.status = 'COMPLETED';
    world.rides[0]!.finalFareMinor = world.rides[0]!.estimatedFareMinor;
    const ok = await p.agent.get(`/api/v1/rides/${id}/receipt`);
    expect(ok.status).toBe(200);
    expect(ok.body.data.receiptNumber).toMatch(/^RW-/);
    expect(ok.body.data.payment).toBeNull();
    const other = await signUp('o@example.com');
    expect((await other.agent.get(`/api/v1/rides/${id}/receipt`)).status).toBe(404);
  });
  it('accepts one 1–5 review for a completed ride and rejects the rest', async () => {
    const { p, id } = await completedRide();
    expect((await p.post(`/api/v1/rides/${id}/reviews`, { rating: 6 })).status).toBe(400);
    expect((await p.post(`/api/v1/rides/${id}/reviews`, { rating: 0 })).status).toBe(400);
    expect((await p.post(`/api/v1/rides/${id}/reviews`, { rating: 5, comment: 'Great' })).status).toBe(201);
    expect((await p.post(`/api/v1/rides/${id}/reviews`, { rating: 4 })).status).toBe(409);
  });
  it('does not allow reviewing a ride that is not completed', async () => {
    const p = await signUp('p@example.com');
    const id = (await p.post('/api/v1/rides', trip)).body.data.ride.id;
    expect((await p.post(`/api/v1/rides/${id}/reviews`, { rating: 5 })).status).toBe(409);
  });
});

describe('saved places and place search', () => {
  it('saves, lists and deletes places for the owner only', async () => {
    const a = await signUp('a@example.com');
    const b = await signUp('b@example.com');
    const created = await a.post('/api/v1/passengers/me/saved-locations', { label: 'Home', ...rosebank, isFavorite: true });
    expect(created.status).toBe(201);
    const locId = created.body.data.location.id;
    expect((await a.agent.get('/api/v1/passengers/me/saved-locations')).body.data.items).toHaveLength(1);
    expect((await b.agent.get('/api/v1/passengers/me/saved-locations')).body.data.items).toHaveLength(0);
    expect((await b.del(`/api/v1/passengers/me/saved-locations/${locId}`)).status).toBe(404);
    expect((await a.del(`/api/v1/passengers/me/saved-locations/${locId}`)).status).toBe(200);
  });
  it('rejects saved places outside the service area', async () => {
    const a = await signUp('a@example.com');
    expect((await a.post('/api/v1/passengers/me/saved-locations', { label: 'Cape', address: 'Cape Town', lat: -33.9, lng: 18.4 })).status).toBe(400);
  });
  it('searches the development place list and says it is not live', async () => {
    const a = await signUp('a@example.com');
    const res = await a.agent.get('/api/v1/places/search?q=rosebank');
    expect(res.status).toBe(200);
    expect(res.body.data.provider).toEqual({ id: 'dev-sample', isLive: false });
    expect(res.body.data.places.length).toBeGreaterThan(0);
    expect((await request(app).get('/api/v1/places/search?q=a')).status).toBe(401);
  });
});
