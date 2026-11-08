import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authWorld } from './helpers/fake-auth-repository';
import { world } from './helpers/fake-rides-repository';

vi.mock('../config/database', () => ({ prisma: { $queryRaw: vi.fn() } }));
vi.mock('../repositories/auth.repository', async () => ({ authRepository: (await import('./helpers/fake-auth-repository')).authWorld.repo }));
vi.mock('../repositories/rides.repository', async () => ({ ridesRepository: (await import('./helpers/fake-rides-repository')).world.ridesRepo }));
vi.mock('../repositories/drivers.repository', async () => ({ driversRepository: (await import('./helpers/fake-rides-repository')).world.driversRepo }));

import { createApp } from '../app';
import { getEarnings, periodStart } from '../services/driver.service';
import { tryMatch } from '../services/matching.service';

const app = createApp();
const PASSWORD = 'Sunrise2026x';
const sandton = { address: 'Sandton City, Rivonia Rd, Sandton', lat: -26.1076, lng: 28.0567 };
const airport = { address: 'OR Tambo International Airport, Kempton Park', lat: -26.1337, lng: 28.242 };
const MELROSE = { lat: -26.1347, lng: 28.0687 }; // about 3.4 km from Sandton City: nearest
const ROSEBANK = { lat: -26.145, lng: 28.0408 }; // about 4.8 km
const AIRPORT = { lat: -26.1337, lng: 28.242 }; // about 18 km: outside the 15 km offer radius
let keySeq = 0;

beforeEach(() => {
  for (const arr of [authWorld.users, authWorld.sessions, authWorld.resets]) arr.length = 0;
  world.reset();
});

async function signUp(email: string, role: 'PASSENGER' | 'DRIVER' = 'PASSENGER') {
  const agent = request.agent(app);
  const res = await agent.post('/api/v1/auth/register').send({ role, fullName: `Name ${email}`, email, password: PASSWORD });
  const raw = ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith('ridewave.csrf='))!;
  const csrf = decodeURIComponent(raw.split(';')[0]!.split('=')[1]!);
  return {
    agent, userId: authWorld.users.find((u) => u.email === email)!.id,
    post: (url: string, body: object = {}) => agent.post(url).set('X-CSRF-Token', csrf).send(body),
    patch: (url: string, body: object) => agent.patch(url).set('X-CSRF-Token', csrf).send(body),
    get: (url: string) => agent.get(url),
  };
}
type Client = Awaited<ReturnType<typeof signUp>>;
async function makeDriver(email: string, opts: Parameters<typeof world.addDriver>[1] = {}) {
  const d = await signUp(email, 'DRIVER');
  return Object.assign(d, { state: world.addDriver(d.userId, { name: `Driver ${email.split('@')[0]}`, ...opts }) });
}
const book = (p: Client, over: object = {}) => p.post('/api/v1/rides', { pickup: sandton, dropoff: airport, categoryCode: 'ECONOMY', idempotencyKey: `key-${++keySeq}-abcdefgh`, ...over });
const ride = async (c: Client, id: string) => (await c.get(`/api/v1/rides/${id}`)).body.data.ride;

describe('driver availability', () => {
  it('only approved drivers with an active vehicle and a valid location can go online', async () => {
    const pending = await makeDriver('pending@example.com', { approved: false, online: false });
    expect((await pending.patch('/api/v1/drivers/me/availability', { isOnline: true })).status).toBe(409);
    const noCar = await makeDriver('nocar@example.com', { vehicle: false, online: false });
    expect((await noCar.patch('/api/v1/drivers/me/availability', { isOnline: true })).status).toBe(409);
    const ok = await makeDriver('ok@example.com', { online: false });
    expect((await ok.patch('/api/v1/drivers/me/availability', { isOnline: true, lat: -33.9, lng: 18.4 })).status).toBe(400); // Cape Town
    expect((await ok.patch('/api/v1/drivers/me/availability', { isOnline: true, lat: -26.1, lng: 28.05 })).status).toBe(200);
    expect(ok.state.isOnline).toBe(true);
    expect((await ok.patch('/api/v1/drivers/me/availability', { isOnline: false })).status).toBe(200);
    expect(ok.state.isOnline).toBe(false);
  });
  it('rejects passengers and half-supplied coordinates', async () => {
    const p = await signUp('p@example.com');
    expect((await p.patch('/api/v1/drivers/me/availability', { isOnline: true })).status).toBe(403);
    const d = await makeDriver('d@example.com');
    expect((await d.patch('/api/v1/drivers/me/availability', { isOnline: true, lat: -26.1 })).status).toBe(400);
  });
  it('cannot go offline while holding a ride', async () => {
    const p = await signUp('p@example.com');
    const d = await makeDriver('d@example.com');
    await book(p);
    expect((await d.patch('/api/v1/drivers/me/availability', { isOnline: false })).status).toBe(409);
  });
});

describe('matching', () => {
  it('offers the ride to the nearest eligible driver immediately and shows an ETA', async () => {
    const p = await signUp('p@example.com');
    await makeDriver('near@example.com', { ...MELROSE, name: 'Near Driver' });
    await makeDriver('mid@example.com', { ...ROSEBANK, name: 'Mid Driver' });
    const id = (await book(p)).body.data.ride.id;
    const r = await ride(p, id);
    expect(r.status).toBe('DRIVER_ASSIGNED');
    expect(r.driver).toMatchObject({ fullName: 'Near Driver' });
    expect(r.driver.vehicle.registration).toBeTruthy();
    expect(r.driverEtaSeconds).toBeGreaterThan(0);
    expect(r.driverEtaIsEstimate).toBe(true);
    expect(JSON.stringify(r)).not.toMatch(/driverLocation|driverUserId/);
  });

  it('skips drivers who are offline, unapproved, in another category, suspended, or too far away', async () => {
    const p = await signUp('p@example.com');
    await makeDriver('off@example.com', { ...MELROSE, online: false });
    await makeDriver('pend@example.com', { ...MELROSE, approved: false });
    await makeDriver('comfort@example.com', { ...MELROSE, categoryCode: 'COMFORT' });
    await makeDriver('susp@example.com', { ...MELROSE, userStatus: 'SUSPENDED' });
    await makeDriver('far@example.com', { ...AIRPORT });
    const id = (await book(p)).body.data.ride.id;
    expect((await ride(p, id)).status).toBe('SEARCHING_FOR_DRIVER');
  });

  it('never gives one driver to two passengers: the second ride keeps searching, then matches a driver who comes online', async () => {
    const p1 = await signUp('p1@example.com');
    const p2 = await signUp('p2@example.com');
    const only = await makeDriver('only@example.com', { ...MELROSE });
    const r1 = (await book(p1)).body.data.ride.id;
    const r2 = (await book(p2)).body.data.ride.id;
    expect((await ride(p1, r1)).status).toBe('DRIVER_ASSIGNED');
    expect((await ride(p2, r2)).status).toBe('SEARCHING_FOR_DRIVER');
    expect(world.rides.filter((r) => r.driverProfileId === only.state.id)).toHaveLength(1);

    const late = await makeDriver('late@example.com', { ...ROSEBANK, online: false });
    await late.patch('/api/v1/drivers/me/availability', { isOnline: true }); // coming online matches the waiting ride
    expect((await ride(p2, r2)).status).toBe('DRIVER_ASSIGNED');
    expect(world.rides.find((r) => r.id === r2)!.driverProfileId).toBe(late.state.id);
  });

  it('survives two bookings arriving at the same moment for one driver', async () => {
    const [p1, p2] = [await signUp('p1@example.com'), await signUp('p2@example.com')];
    await makeDriver('only@example.com', { ...MELROSE });
    await Promise.all([book(p1), book(p2)]);
    expect(world.rides.filter((r) => r.status === 'DRIVER_ASSIGNED')).toHaveLength(1);
    expect(world.rides.filter((r) => r.status === 'SEARCHING_FOR_DRIVER')).toHaveLength(1);
    await Promise.all(world.rides.map((r) => tryMatch(r.id))); // extra matching passes change nothing
    expect(world.rides.filter((r) => r.status === 'DRIVER_ASSIGNED')).toHaveLength(1);
  });

  it('shows a pending offer only to the offered driver, with a deadline and the driver’s share of the fare', async () => {
    const p = await signUp('p@example.com');
    const near = await makeDriver('near@example.com', { ...MELROSE });
    const other = await makeDriver('other@example.com', { ...AIRPORT });
    const id = (await book(p)).body.data.ride.id;
    const offers = (await near.get('/api/v1/drivers/me/ride-requests')).body.data.items;
    expect(offers).toHaveLength(1);
    expect(offers[0]).toMatchObject({ rideId: id, passengerFirstName: 'Pat' });
    expect(new Date(offers[0].offerExpiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(offers[0].estimatedEarningsMinor).toBe(Math.floor(offers[0].estimatedFareMinor * 0.8));
    expect(JSON.stringify(offers)).not.toMatch(/@example\.com/);
    expect((await other.get('/api/v1/drivers/me/ride-requests')).body.data.items).toHaveLength(0);
  });
});

describe('accepting and declining', () => {
  it('lets only the offered driver accept, once', async () => {
    const p = await signUp('p@example.com');
    const near = await makeDriver('near@example.com', { ...MELROSE });
    const other = await makeDriver('other@example.com', { ...ROSEBANK });
    const id = (await book(p)).body.data.ride.id;
    expect((await other.post(`/api/v1/rides/${id}/accept`)).status).toBe(404);
    expect((await p.post(`/api/v1/rides/${id}/accept`)).status).toBe(403);
    const ok = await near.post(`/api/v1/rides/${id}/accept`);
    expect(ok.status).toBe(200);
    expect(ok.body.data.ride.status).toBe('DRIVER_ARRIVING');
    expect((await near.post(`/api/v1/rides/${id}/accept`)).status).toBe(409);
  });

  it('re-offers a declined ride to the next driver, never back to the one who declined, and runs out gracefully', async () => {
    const p = await signUp('p@example.com');
    const near = await makeDriver('near@example.com', { ...MELROSE });
    const mid = await makeDriver('mid@example.com', { ...ROSEBANK });
    const id = (await book(p)).body.data.ride.id;
    expect((await near.post(`/api/v1/rides/${id}/decline`)).status).toBe(200);
    expect(world.rides[0]!.driverProfileId).toBe(mid.state.id);
    expect(world.rides[0]!.status).toBe('DRIVER_ASSIGNED');
    expect((await mid.post(`/api/v1/rides/${id}/decline`)).status).toBe(200);
    expect(world.rides[0]!.status).toBe('SEARCHING_FOR_DRIVER');
    expect(world.rides[0]!.declinedBy).toEqual([near.state.id, mid.state.id]);
    expect((await near.post(`/api/v1/rides/${id}/decline`)).status).toBe(404); // no longer theirs
  });

  it('expires an unanswered offer and passes it on; an expired offer cannot be accepted', async () => {
    const p = await signUp('p@example.com');
    const near = await makeDriver('near@example.com', { ...MELROSE });
    const mid = await makeDriver('mid@example.com', { ...ROSEBANK });
    const id = (await book(p)).body.data.ride.id;
    world.rides[0]!.assignedAt = new Date(Date.now() - 120_000); // offered 2 minutes ago, never answered
    expect((await near.post(`/api/v1/rides/${id}/accept`)).status).toBe(409);
    expect(world.rides[0]!.driverProfileId).toBe(mid.state.id); // handed to the next driver
    expect((await ride(p, id)).status).toBe('DRIVER_ASSIGNED');
  });

  it('turns into NO_DRIVER_AVAILABLE after the search timeout, and the passenger can retry once a driver appears', async () => {
    const p = await signUp('p@example.com');
    const id = (await book(p)).body.data.ride.id;
    expect((await ride(p, id)).status).toBe('SEARCHING_FOR_DRIVER');
    for (const h of world.rides[0]!.statusHistory) h.createdAt = new Date(Date.now() - 5 * 60_000);
    expect((await ride(p, id)).status).toBe('NO_DRIVER_AVAILABLE');
    expect((await p.post(`/api/v1/rides/${id}/retry`)).status).toBe(200); // retry with nobody online: back to searching
    expect(world.rides[0]!.status).toBe('SEARCHING_FOR_DRIVER');
    expect((await p.post(`/api/v1/rides/${id}/retry`)).status).toBe(409); // not in NO_DRIVER_AVAILABLE any more
    await makeDriver('d@example.com', { ...MELROSE });
    expect((await ride(p, id)).status).toBe('DRIVER_ASSIGNED'); // polling finds the new driver
  });
});

describe('trip lifecycle', () => {
  async function setup() {
    const p = await signUp('p@example.com');
    const d = await makeDriver('d@example.com', { ...MELROSE });
    const id = (await book(p)).body.data.ride.id;
    return { p, d, id };
  }

  it('runs accept → arrive → start → complete, then produces a receipt and accepts a review', async () => {
    const { p, d, id } = await setup();
    for (const step of ['accept', 'arrive', 'start']) expect((await d.post(`/api/v1/rides/${id}/${step}`)).status).toBe(200);
    expect((await ride(p, id)).status).toBe('IN_PROGRESS');
    const done = await d.post(`/api/v1/rides/${id}/complete`);
    expect(done.status).toBe(200);
    const r = await ride(p, id);
    expect(r.status).toBe('COMPLETED');
    expect(r.finalFareMinor).toBe(r.estimatedFareMinor); // a quick demo trip never bills below the estimate
    expect(r.statusHistory.map((h: { toStatus: string }) => h.toStatus)).toEqual(['REQUESTED', 'SEARCHING_FOR_DRIVER', 'DRIVER_ASSIGNED', 'DRIVER_ARRIVING', 'DRIVER_ARRIVED', 'IN_PROGRESS', 'COMPLETED']);
    expect((await p.get(`/api/v1/rides/${id}/receipt`)).status).toBe(200);
    expect((await p.post(`/api/v1/rides/${id}/reviews`, { rating: 5 })).status).toBe(201);
  });

  it('enforces the order of steps', async () => {
    const { d, id } = await setup();
    expect((await d.post(`/api/v1/rides/${id}/arrive`)).status).toBe(409); // not accepted yet
    expect((await d.post(`/api/v1/rides/${id}/start`)).status).toBe(409);
    expect((await d.post(`/api/v1/rides/${id}/complete`)).status).toBe(409);
    await d.post(`/api/v1/rides/${id}/accept`);
    expect((await d.post(`/api/v1/rides/${id}/start`)).status).toBe(409); // has not arrived
    expect((await d.post(`/api/v1/rides/${id}/complete`)).status).toBe(409);
    await d.post(`/api/v1/rides/${id}/arrive`);
    expect((await d.post(`/api/v1/rides/${id}/complete`)).status).toBe(409); // not started
    expect((await d.post(`/api/v1/rides/${id}/accept`)).status).toBe(409);
    await d.post(`/api/v1/rides/${id}/start`);
    expect((await d.post(`/api/v1/rides/${id}/arrive`)).status).toBe(409);
    expect((await d.post(`/api/v1/rides/${id}/start`)).status).toBe(409);
  });

  it('cannot start, complete or cancel a ride that is already completed', async () => {
    const { p, d, id } = await setup();
    for (const step of ['accept', 'arrive', 'start', 'complete']) await d.post(`/api/v1/rides/${id}/${step}`);
    for (const step of ['accept', 'arrive', 'start', 'complete']) expect((await d.post(`/api/v1/rides/${id}/${step}`)).status).toBe(409);
    expect((await p.post(`/api/v1/rides/${id}/cancel`)).status).toBe(409);
    expect(world.rides[0]!.status).toBe('COMPLETED');
  });

  it('bills real time when a trip takes longer than estimated, with an itemised breakdown', async () => {
    const { p, d, id } = await setup();
    for (const step of ['accept', 'arrive', 'start']) await d.post(`/api/v1/rides/${id}/${step}`);
    world.rides[0]!.startedAt = new Date(Date.now() - 3 * 3600_000);
    await d.post(`/api/v1/rides/${id}/complete`);
    const r = await ride(p, id);
    expect(r.finalFareMinor).toBeGreaterThan(r.estimatedFareMinor);
    expect(r.fareBreakdown.timeChargeMinor).toBeGreaterThan(0);
    expect(r.fareBreakdown.totalMinor).toBe(r.finalFareMinor);
  });

  it('keeps passengers and other drivers out of driver actions and private ride data', async () => {
    const { p, d, id } = await setup();
    const stranger = await makeDriver('stranger@example.com', { ...AIRPORT });
    for (const step of ['arrive', 'start', 'complete']) expect((await p.post(`/api/v1/rides/${id}/${step}`)).status).toBe(403);
    expect((await stranger.get(`/api/v1/rides/${id}`)).status).toBe(404);
    expect((await stranger.get('/api/v1/drivers/me/rides')).body.data.total).toBe(0);
    expect((await d.get('/api/v1/drivers/me/rides')).body.data.total).toBe(1);
    const asDriver = await d.get(`/api/v1/rides/${id}`);
    expect(asDriver.status).toBe(200);
    expect(JSON.stringify(asDriver.body)).not.toContain('p@example.com'); // no passenger contact details
  });
});

describe('driver earnings and statistics', () => {
  const NOW = Date.UTC(2026, 9, 15, 10, 0, 0); // Thursday 15 Oct 2026, 12:00 in Johannesburg

  it('computes day, week and month windows in Johannesburg time (week starts Monday)', () => {
    expect(new Date(periodStart('day', NOW)).toISOString()).toBe('2026-10-14T22:00:00.000Z');
    expect(new Date(periodStart('week', NOW)).toISOString()).toBe('2026-10-11T22:00:00.000Z'); // Monday 12 Oct 00:00 SAST
    expect(new Date(periodStart('month', NOW)).toISOString()).toBe('2026-09-30T22:00:00.000Z'); // 1 Oct 00:00 SAST
  });

  it('totals completed trips per period, takes the demonstration commission, and reports acceptance statistics', async () => {
    const d = await makeDriver('d@example.com', { ...MELROSE });
    const pid = d.state.id;
    const done = (iso: string, fare: number) => world.rides.push({ ...({} as (typeof world.rides)[number]), id: `x${world.rides.length}`, status: 'COMPLETED', driverProfileId: pid, completedAt: new Date(iso), finalFareMinor: fare, statusHistory: [] });
    done('2026-10-15T09:00:00Z', 27500); // today
    done('2026-10-13T08:00:00Z', 10000); // Tuesday, this week
    done('2026-09-30T08:00:00Z', 99999); // last month: excluded from every period here
    const user = authWorld.users.find((u) => u.id === d.userId)!;

    const day = await getEarnings(user, 'day', NOW);
    expect(day).toMatchObject({ trips: 1, grossMinor: 27500, netMinor: 22000, commissionMinor: 5500, commission: { rateBp: 2000, isDemonstrationRate: true } });
    const week = await getEarnings(user, 'week', NOW);
    expect(week).toMatchObject({ trips: 2, grossMinor: 37500, netMinor: 30000 });
    expect(week.daily.map((x) => x.date)).toEqual(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15']);
    expect(week.daily.map((x) => x.trips)).toEqual([0, 1, 0, 1]);
    expect((await getEarnings(user, 'month', NOW)).trips).toBe(2);
    expect(week.stats.completedTripsAllTime).toBe(3);
    expect(week.stats.acceptanceRatePercent).toBeNull(); // no offers answered yet
  });

  it('counts accepted and declined offers for the acceptance rate', async () => {
    const p1 = await signUp('p1@example.com');
    const p2 = await signUp('p2@example.com');
    const d = await makeDriver('d@example.com', { ...MELROSE });
    const r1 = (await book(p1)).body.data.ride.id;
    await d.post(`/api/v1/rides/${r1}/decline`);
    expect((await book(p1, { idempotencyKey: 'another-key-0001' })).status).toBe(409); // the first ride is still active (searching)
    await p1.post(`/api/v1/rides/${r1}/cancel`);
    const r2 = (await book(p2)).body.data.ride.id;
    await d.post(`/api/v1/rides/${r2}/accept`);
    const res = (await d.get('/api/v1/drivers/me/earnings?period=month')).body.data;
    expect(res.stats).toMatchObject({ offersAccepted: 1, offersDeclined: 1, acceptanceRatePercent: 50 });
    expect((await d.get('/api/v1/drivers/me/earnings?period=year')).status).toBe(400);
  });
});

describe('driver vehicles', () => {
  const car = { categoryCode: 'ECONOMY', make: 'Toyota', model: 'Corolla', year: 2020, colour: 'Silver', registration: 'ab 12 cd gp', passengerCapacity: 4 };
  it('adds a vehicle, normalises the registration, and rejects duplicates', async () => {
    const d = await makeDriver('d@example.com', { vehicle: false, online: false });
    const ok = await d.post('/api/v1/drivers/me/vehicles', car);
    expect(ok.status).toBe(201);
    expect(ok.body.data.vehicle.registration).toBe('AB12CDGP');
    expect((await d.get('/api/v1/drivers/me/vehicles')).body.data.items).toHaveLength(1);
    const other = await makeDriver('e@example.com', { vehicle: false, online: false });
    expect((await other.post('/api/v1/drivers/me/vehicles', car)).status).toBe(409);
  });
  it('requires enough seats for the category and a sensible year', async () => {
    const d = await makeDriver('d@example.com', { vehicle: false, online: false });
    expect((await d.post('/api/v1/drivers/me/vehicles', { ...car, categoryCode: 'XL', passengerCapacity: 4 })).status).toBe(400);
    expect((await d.post('/api/v1/drivers/me/vehicles', { ...car, year: 1980 })).status).toBe(400);
    expect((await d.post('/api/v1/drivers/me/vehicles', { ...car, categoryCode: 'XL', passengerCapacity: 6 })).status).toBe(201);
  });
  it('is driver-only', async () => {
    const p = await signUp('p@example.com');
    expect((await p.post('/api/v1/drivers/me/vehicles', car)).status).toBe(403);
  });
});
