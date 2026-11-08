import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminWorld } from './helpers/fake-admin-repository';
import { extras } from './helpers/fake-extras';
import { authWorld } from './helpers/fake-auth-repository';
import { world, type StoredRide } from './helpers/fake-rides-repository';

vi.mock('../config/database', () => ({ prisma: { $queryRaw: vi.fn() } }));
vi.mock('../repositories/auth.repository', async () => ({ authRepository: (await import('./helpers/fake-auth-repository')).authWorld.repo }));
vi.mock('../repositories/rides.repository', async () => ({ ridesRepository: (await import('./helpers/fake-rides-repository')).world.ridesRepo }));
vi.mock('../repositories/drivers.repository', async () => ({ driversRepository: (await import('./helpers/fake-rides-repository')).world.driversRepo }));
vi.mock('../repositories/admin.repository', async () => ({ adminRepository: (await import('./helpers/fake-admin-repository')).adminWorld.repo }));

import { createApp } from '../app';
import { hashPassword } from '../utils/password';
import { localDate } from '../utils/time';

const app = createApp();
const PASSWORD = 'Sunrise2026x';
const sandton = { address: 'Sandton City, Rivonia Rd, Sandton', lat: -26.1076, lng: 28.0567 };
const airport = { address: 'OR Tambo International Airport, Kempton Park', lat: -26.1337, lng: 28.242 };
const MELROSE = { lat: -26.1347, lng: 28.0687 };
const PDF = Buffer.from('%PDF-1.4\n% demo document\n%%EOF\n');
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('demo-image-bytes')]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('demo-jpeg-bytes')]);
let keySeq = 0;

beforeEach(() => {
  for (const arr of [authWorld.users, authWorld.sessions, authWorld.resets]) arr.length = 0;
  world.reset();
  adminWorld.reset();
});

async function client(agent: request.Agent, csrf: string, userId: string) {
  return {
    agent, userId,
    get: (url: string) => agent.get(url),
    post: (url: string, body: object = {}) => agent.post(url).set('X-CSRF-Token', csrf).send(body),
    patch: (url: string, body: object) => agent.patch(url).set('X-CSRF-Token', csrf).send(body),
    upload: (url: string, type: string, file?: { buf: Buffer; name: string; mime?: string }) => {
      const r = agent.post(url).set('X-CSRF-Token', csrf).field('type', type);
      return file ? r.attach('file', file.buf, { filename: file.name, contentType: file.mime ?? 'application/pdf' }) : r;
    },
  };
}
type Client = Awaited<ReturnType<typeof client>>;
const csrfOf = (res: request.Response) => decodeURIComponent(([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith('ridewave.csrf='))!.split(';')[0]!.split('=')[1]!);

async function signUp(email: string, role: 'PASSENGER' | 'DRIVER' = 'PASSENGER') {
  const agent = request.agent(app);
  const res = await agent.post('/api/v1/auth/register').send({ role, fullName: `Name ${email.split('@')[0]}`, email, password: PASSWORD });
  return client(agent, csrfOf(res), authWorld.users.find((u) => u.email === email)!.id);
}
async function makeAdmin(email = 'boss@example.com') {
  const u = await authWorld.repo.createUserWithProfile({ email, phone: null, fullName: 'The Boss', passwordHash: await hashPassword(PASSWORD), role: 'PASSENGER' });
  u.role = 'ADMIN';
  const agent = request.agent(app);
  const res = await agent.post('/api/v1/auth/login').send({ email, password: PASSWORD });
  return client(agent, csrfOf(res), u.id);
}
async function makeDriver(email: string, opts: Parameters<typeof world.addDriver>[1] = {}) {
  const c = await signUp(email, 'DRIVER');
  return Object.assign(c, { state: world.addDriver(c.userId, { name: `Driver ${email.split('@')[0]}`, ...opts }) });
}
const book = (p: Client) => p.post('/api/v1/rides', { pickup: sandton, dropoff: airport, categoryCode: 'ECONOMY', idempotencyKey: `key-${++keySeq}-abcdefgh` });
const A = '/api/v1/admin';
const auditActions = () => adminWorld.audit.map((a) => a.action);

describe('authorization: every admin endpoint is admin-only on the server', () => {
  const routes: Array<['get' | 'post' | 'patch', string, object?]> = [
    ['get', '/analytics'], ['get', '/users'], ['patch', '/users/u1/status', { status: 'SUSPENDED' }], ['get', '/drivers'], ['get', '/drivers/d1'],
    ['patch', '/drivers/d1/approval', { status: 'APPROVED' }], ['get', '/documents/x/download'], ['patch', '/documents/x', { status: 'ACCEPTED' }], ['get', '/vehicles'],
    ['patch', '/vehicles/v1', { isActive: false }], ['get', '/rides'], ['post', '/rides/r1/cancel', { reason: 'abc' }], ['get', '/categories'], ['patch', '/categories/c1', { name: 'New name' }],
    ['get', '/pricing'], ['patch', '/pricing', { categoryCode: 'ECONOMY', baseFareMinor: 1 }], ['get', '/support-tickets'], ['patch', '/support-tickets/t1', { status: 'CLOSED' }],
    ['get', '/reviews'], ['get', '/audit-logs'], ['get', '/payments'], ['get', '/settings'], ['patch', '/settings', { offerTtlSeconds: 30 }],
    ['post', '/notifications', { audience: 'ALL', title: 'Hello', body: 'World!' }],
  ];
  it('returns 401 to anonymous visitors and 403 to passengers and drivers, for all endpoints', async () => {
    const passenger = await signUp('p@example.com');
    const driver = await makeDriver('d@example.com');
    for (const [method, url, body] of routes) {
      const anon = await (request(app) as unknown as Record<string, (u: string) => request.Test>)[method]!(`${A}${url}`).send(body);
      expect([method, url, anon.status]).toEqual([method, url, 401]);
      for (const who of [passenger, driver]) {
        const res = method === 'get' ? await who.get(`${A}${url}`) : await who[method](`${A}${url}`, body ?? {});
        expect([method, url, res.status]).toEqual([method, url, 403]);
      }
    }
    expect(adminWorld.audit).toHaveLength(0); // nothing was changed or logged
  });
});

describe('analytics come from real records', () => {
  const ride = (over: Partial<StoredRide>) => {
    world.rides.push({
      id: `x${world.rides.length}`, statusHistory: [], category: { code: 'ECONOMY', name: 'RideWave Economy' }, pickup: sandton, dropoff: airport, estimatedFareMinor: 0, finalFareMinor: null,
      completedAt: null, driverProfileId: null, passengerUserId: '', ...over,
    } as StoredRide);
  };

  it('is all zeros on an empty platform', async () => {
    const admin = await makeAdmin();
    const res = await admin.get(`${A}/analytics`);
    expect(res.status).toBe(200);
    expect(res.body.data.overview).toMatchObject({ passengers: 0, drivers: 0, completedRides: 0, revenueMinor: 0, activeRides: 0 });
    expect(res.body.data.volume.every((d: { requested: number }) => d.requested === 0)).toBe(true);
  });

  it('counts users, rides and revenue from the data, and buckets the volume by Johannesburg day', async () => {
    const admin = await makeAdmin();
    const p = await signUp('p@example.com');
    const d = await makeDriver('d@example.com', { approved: false });
    await makeDriver('d2@example.com');
    const today = new Date();
    const yesterday = new Date(Date.now() - 86_400_000);
    ride({ status: 'COMPLETED', requestedAt: today, completedAt: today, finalFareMinor: 27500, driverProfileId: d.state.id, passengerUserId: p.userId });
    ride({ status: 'COMPLETED', requestedAt: yesterday, completedAt: yesterday, finalFareMinor: 10000, driverProfileId: d.state.id, passengerUserId: p.userId });
    ride({ status: 'CANCELLED', requestedAt: yesterday, passengerUserId: p.userId });
    ride({ status: 'SEARCHING_FOR_DRIVER', requestedAt: today, passengerUserId: p.userId });
    ride({ status: 'COMPLETED', requestedAt: new Date(Date.now() - 40 * 86_400_000), completedAt: new Date(Date.now() - 40 * 86_400_000), finalFareMinor: 99999, passengerUserId: p.userId }); // outside the 14-day chart

    const res = await admin.get(`${A}/analytics?days=14`);
    const { overview, volume, topDrivers, recentRides } = res.body.data;
    expect(overview).toMatchObject({ totalUsers: 4, passengers: 1, drivers: 2, pendingDriverApprovals: 1, activeRides: 1, completedRides: 3, cancelledRides: 1, revenueMinor: 137499 });
    expect(volume).toHaveLength(14);
    const day = (ms: number) => volume.find((v: { date: string }) => v.date === localDate(ms));
    expect(day(today.getTime())).toMatchObject({ requested: 2, completed: 1, revenueMinor: 27500 });
    expect(day(yesterday.getTime())).toMatchObject({ requested: 2, cancelled: 1, completed: 1, revenueMinor: 10000 });
    expect(volume.reduce((s: number, v: { revenueMinor: number }) => s + v.revenueMinor, 0)).toBe(37500); // the 40-day-old ride is excluded
    expect(topDrivers[0]).toMatchObject({ completedTrips: 2, grossMinor: 37500 });
    expect(recentRides.length).toBeGreaterThan(0);
    expect(res.body.data.notes.revenue).toMatch(/not money received/);
  });

  it('validates the window length', async () => {
    const admin = await makeAdmin();
    expect((await admin.get(`${A}/analytics?days=3`)).status).toBe(400);
    expect((await admin.get(`${A}/analytics?days=500`)).status).toBe(400);
  });
});

describe('user management', () => {
  it('filters, sorts and pages the user list without exposing password hashes', async () => {
    const admin = await makeAdmin();
    await signUp('zed@example.com'); await signUp('amy@example.com'); await makeDriver('drv@example.com');
    const drivers = await admin.get(`${A}/users?role=DRIVER`);
    expect(drivers.body.data.total).toBe(1);
    const sorted = await admin.get(`${A}/users?role=PASSENGER&sort=fullName&dir=asc`);
    expect(sorted.body.data.items.map((u: { email: string }) => u.email)).toEqual(['amy@example.com', 'zed@example.com']);
    expect((await admin.get(`${A}/users?pageSize=2&page=2`)).body.data.items).toHaveLength(2);
    expect(JSON.stringify(sorted.body)).not.toContain('passwordHash');
    expect((await admin.get(`${A}/users?role=ROBOT`)).status).toBe(400);
  });

  it('suspends a user: signs them out at once, blocks sign-in, and writes an audit entry; reactivation restores access', async () => {
    const admin = await makeAdmin();
    const p = await signUp('p@example.com');
    expect((await p.get('/api/v1/auth/me')).status).toBe(200);
    const res = await admin.patch(`${A}/users/${p.userId}/status`, { status: 'SUSPENDED', reason: 'Abusive behaviour' });
    expect(res.status).toBe(200);
    expect((await p.get('/api/v1/auth/me')).status).toBe(401); // the session was revoked server-side
    expect((await request(app).post('/api/v1/auth/login').send({ email: 'p@example.com', password: PASSWORD })).status).toBe(403);
    expect(adminWorld.audit[0]).toMatchObject({ action: 'USER_STATUS_CHANGED', entityType: 'User', entityId: p.userId, actorEmail: 'boss@example.com', metadata: { from: 'ACTIVE', to: 'SUSPENDED', reason: 'Abusive behaviour' } });
    expect((await admin.patch(`${A}/users/${p.userId}/status`, { status: 'ACTIVE' })).status).toBe(200);
    expect((await request(app).post('/api/v1/auth/login').send({ email: 'p@example.com', password: PASSWORD })).status).toBe(200);
  });

  it('takes a suspended driver offline so they stop receiving rides', async () => {
    const admin = await makeAdmin();
    const d = await makeDriver('d@example.com', { ...MELROSE });
    await admin.patch(`${A}/users/${d.userId}/status`, { status: 'SUSPENDED' });
    expect(d.state.isOnline).toBe(false);
  });

  it('refuses self-changes, unknown users, bad statuses and extra fields', async () => {
    const admin = await makeAdmin();
    expect((await admin.patch(`${A}/users/${admin.userId}/status`, { status: 'SUSPENDED' })).status).toBe(403);
    expect((await admin.patch(`${A}/users/nope/status`, { status: 'SUSPENDED' })).status).toBe(404);
    expect((await admin.patch(`${A}/users/${admin.userId}/status`, { status: 'BANNED' })).status).toBe(400);
    expect((await admin.patch(`${A}/users/${admin.userId}/status`, { status: 'ACTIVE', role: 'ADMIN' })).status).toBe(400);
    expect(adminWorld.audit).toHaveLength(0);
  });
});

describe('driver approval', () => {
  it('approves a pending driver (audited) so they can go online and be matched', async () => {
    const admin = await makeAdmin();
    const p = await signUp('p@example.com');
    const d = await makeDriver('d@example.com', { ...MELROSE, approved: false, online: false });
    expect((await d.patch('/api/v1/drivers/me/availability', { isOnline: true })).status).toBe(409);
    expect((await admin.get(`${A}/drivers?approval=PENDING`)).body.data.total).toBe(1);
    const res = await admin.patch(`${A}/drivers/${d.state.id}/approval`, { status: 'APPROVED', note: 'Documents look fine' });
    expect(res.status).toBe(200);
    expect(auditActions()).toEqual(['DRIVER_APPROVAL_CHANGED']);
    expect(adminWorld.audit[0]!.metadata).toMatchObject({ from: 'PENDING', to: 'APPROVED' });
    expect((await d.patch('/api/v1/drivers/me/availability', { isOnline: true })).status).toBe(200);
    const ride = (await book(p)).body.data.ride;
    expect((await p.get(`/api/v1/rides/${ride.id}`)).body.data.ride.status).toBe('DRIVER_ASSIGNED');
  });

  it('requires a reason to reject or suspend, and forces the driver offline', async () => {
    const admin = await makeAdmin();
    const d = await makeDriver('d@example.com', { ...MELROSE });
    expect((await admin.patch(`${A}/drivers/${d.state.id}/approval`, { status: 'REJECTED' })).status).toBe(400);
    expect((await admin.patch(`${A}/drivers/${d.state.id}/approval`, { status: 'SUSPENDED', note: 'x' })).status).toBe(400);
    expect(d.state.approval).toBe('APPROVED');
    expect((await admin.patch(`${A}/drivers/${d.state.id}/approval`, { status: 'SUSPENDED', note: 'Safety complaint' })).status).toBe(200);
    expect(d.state).toMatchObject({ approval: 'SUSPENDED', isOnline: false });
    expect((await admin.patch(`${A}/drivers/nope/approval`, { status: 'APPROVED' })).status).toBe(404);
  });

  it('shows driver detail with vehicles and documents (without storage paths)', async () => {
    const admin = await makeAdmin();
    const d = await makeDriver('d@example.com');
    await d.upload('/api/v1/drivers/me/documents', 'DRIVERS_LICENCE', { buf: PDF, name: 'licence.pdf' });
    const res = await admin.get(`${A}/drivers/${d.state.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.driver.vehicles).toHaveLength(1);
    expect(res.body.data.driver.documents).toHaveLength(1);
    expect(JSON.stringify(res.body)).not.toContain('storageKey');
  });
});

describe('private driver documents', () => {
  const storageDir = path.join(process.env.STORAGE_DIR!, 'documents');

  it('accepts PDF, PNG and JPEG by their real content and stores them privately under random names', async () => {
    const d = await makeDriver('d@example.com');
    for (const [buf, name, mime] of [[PDF, 'my licence.pdf', 'application/pdf'], [PNG, 'id.png', 'image/png'], [JPEG, 'photo.jpg', 'image/jpeg']] as const) {
      const res = await d.upload('/api/v1/drivers/me/documents', 'ID_DOCUMENT', { buf, name, mime });
      expect(res.status).toBe(201);
      expect(res.body.data.document).toMatchObject({ status: 'SUBMITTED', mimeType: mime });
      expect(res.body.data.document.storageKey).toBeUndefined(); // clients never learn the storage path
    }
    const stored = world.docs.map((x) => x.storageKey);
    expect(stored.every((k) => /^[a-f0-9]{32}\.(pdf|png|jpg)$/.test(k))).toBe(true);
    for (const k of stored) expect(fs.existsSync(path.join(storageDir, k))).toBe(true);
    expect(world.docs[0]!.originalName).toBe('my licence.pdf');
  });

  it('rejects files whose content is not PDF/PNG/JPEG, however they are named or labelled', async () => {
    const d = await makeDriver('d@example.com');
    const fake = Buffer.from('MZ\x90\x00this is an executable pretending to be a pdf');
    expect((await d.upload('/api/v1/drivers/me/documents', 'ID_DOCUMENT', { buf: fake, name: 'licence.pdf', mime: 'application/pdf' })).status).toBe(400);
    expect((await d.upload('/api/v1/drivers/me/documents', 'ID_DOCUMENT', { buf: Buffer.from('<script>alert(1)</script>'), name: 'x.png', mime: 'image/png' })).status).toBe(400);
    expect((await d.upload('/api/v1/drivers/me/documents', 'ID_DOCUMENT', { buf: Buffer.alloc(0), name: 'empty.pdf' })).status).toBe(400);
    expect(world.docs).toHaveLength(0);
  });

  it('rejects oversized files, missing files and unknown document types', async () => {
    const d = await makeDriver('d@example.com');
    const big = Buffer.concat([PDF, Buffer.alloc(5 * 1024 * 1024 + 1024, 0x20)]);
    expect((await d.upload('/api/v1/drivers/me/documents', 'ID_DOCUMENT', { buf: big, name: 'big.pdf' })).status).toBe(413);
    expect((await d.upload('/api/v1/drivers/me/documents', 'ID_DOCUMENT')).status).toBe(400);
    expect((await d.upload('/api/v1/drivers/me/documents', 'SECRET_STUFF', { buf: PDF, name: 'a.pdf' })).status).toBe(400);
    expect(world.docs).toHaveLength(0);
  });

  it('is driver-only, and the files are not reachable as static content', async () => {
    const p = await signUp('p@example.com');
    expect((await p.upload('/api/v1/drivers/me/documents', 'ID_DOCUMENT', { buf: PDF, name: 'a.pdf' })).status).toBe(403);
    expect((await request(app).post('/api/v1/drivers/me/documents').attach('file', PDF, 'a.pdf')).status).toBe(401);
    const d = await makeDriver('d@example.com');
    await d.upload('/api/v1/drivers/me/documents', 'ID_DOCUMENT', { buf: PDF, name: 'a.pdf' });
    const key = world.docs[0]!.storageKey;
    for (const url of [`/${key}`, `/documents/${key}`, `/storage/documents/${key}`, `/api/v1/documents/${key}`, `/api/v1/storage/${key}`]) expect((await request(app).get(url)).status).toBe(404);
  });

  it('lets only the owner and administrators download a document, with safe headers; admin access is audited', async () => {
    const admin = await makeAdmin();
    const owner = await makeDriver('owner@example.com');
    const other = await makeDriver('other@example.com');
    const up = await owner.upload('/api/v1/drivers/me/documents', 'DRIVERS_LICENCE', { buf: PDF, name: 'licence.pdf' });
    const id = up.body.data.document.id;

    expect((await owner.get('/api/v1/drivers/me/documents')).body.data.items).toHaveLength(1);
    expect((await other.get('/api/v1/drivers/me/documents')).body.data.items).toHaveLength(0);
    expect((await other.get(`/api/v1/drivers/me/documents/${id}/download`)).status).toBe(404);
    expect((await owner.get(`/api/v1/drivers/me/documents/${id}/download`)).status).toBe(200);
    expect((await (await signUp('p@example.com')).get(`${A}/documents/${id}/download`)).status).toBe(403);
    expect(adminWorld.audit).toHaveLength(0);

    const dl = await admin.get(`${A}/documents/${id}/download`).buffer(true).parse((res, cb) => { const chunks: Buffer[] = []; res.on('data', (c) => chunks.push(c)); res.on('end', () => cb(null, Buffer.concat(chunks))); });
    expect(dl.status).toBe(200);
    expect(Buffer.from(dl.body).equals(PDF)).toBe(true);
    expect(dl.headers['content-type']).toBe('application/pdf');
    expect(dl.headers['content-disposition']).toMatch(/^attachment; filename="drivers_licence-/);
    expect(dl.headers['x-content-type-options']).toBe('nosniff');
    expect(dl.headers['cache-control']).toMatch(/private/);
    expect(adminWorld.audit[0]).toMatchObject({ action: 'DOCUMENT_VIEWED', entityId: id, actorEmail: 'boss@example.com' });
  });

  it('cannot be tricked into reading other files through a bad storage key', async () => {
    const admin = await makeAdmin();
    const d = await makeDriver('d@example.com');
    world.docs.push({ id: 'evil', driverId: d.state.id, type: 'ID_DOCUMENT', status: 'SUBMITTED', originalName: 'x', storageKey: '../../../../etc/passwd', mimeType: 'application/pdf', sizeBytes: 1, reviewNote: null, createdAt: new Date(), reviewedAt: null });
    expect((await admin.get(`${A}/documents/evil/download`)).status).toBe(404);
    expect((await d.get('/api/v1/drivers/me/documents/evil/download')).status).toBe(404);
  });

  it('lets an administrator accept or reject a document, requiring a reason to reject, and logs it', async () => {
    const admin = await makeAdmin();
    const d = await makeDriver('d@example.com');
    const id = (await d.upload('/api/v1/drivers/me/documents', 'DRIVERS_LICENCE', { buf: PDF, name: 'l.pdf' })).body.data.document.id;
    expect((await admin.patch(`${A}/documents/${id}`, { status: 'REJECTED' })).status).toBe(400);
    expect((await admin.patch(`${A}/documents/${id}`, { status: 'REJECTED', note: 'Photo is blurry' })).status).toBe(200);
    expect((await d.get('/api/v1/drivers/me/documents')).body.data.items[0]).toMatchObject({ status: 'REJECTED', reviewNote: 'Photo is blurry' });
    expect((await admin.patch(`${A}/documents/${id}`, { status: 'ACCEPTED' })).status).toBe(200);
    expect(auditActions()).toEqual(['DOCUMENT_REVIEWED', 'DOCUMENT_REVIEWED']);
    expect((await admin.patch(`${A}/documents/nope`, { status: 'ACCEPTED' })).status).toBe(404);
  });
});

describe('ride management', () => {
  it('lists and filters rides, and cancels an active ride with a reason (audited)', async () => {
    const admin = await makeAdmin();
    const p = await signUp('p@example.com');
    const id = (await book(p)).body.data.ride.id;
    expect((await admin.get(`${A}/rides?status=SEARCHING_FOR_DRIVER`)).body.data.total).toBe(1);
    expect((await admin.get(`${A}/rides?status=COMPLETED`)).body.data.total).toBe(0);
    expect((await admin.get(`${A}/rides?search=Sandton`)).body.data.items[0]).toMatchObject({ id, passengerName: 'Name p' });

    expect((await admin.post(`${A}/rides/${id}/cancel`, {})).status).toBe(400);
    const res = await admin.post(`${A}/rides/${id}/cancel`, { reason: 'Passenger reported a problem' });
    expect(res.status).toBe(200);
    expect(world.rides[0]).toMatchObject({ status: 'CANCELLED', cancelledBy: 'ADMIN', cancellationReason: 'Passenger reported a problem' });
    expect(world.rides[0]!.statusHistory.at(-1)).toMatchObject({ toStatus: 'CANCELLED', actorType: 'ADMIN' });
    expect(adminWorld.audit[0]).toMatchObject({ action: 'RIDE_CANCELLED_BY_ADMIN', entityId: id });
  });

  it('cannot cancel completed or in-progress rides, or unknown ones', async () => {
    const admin = await makeAdmin();
    const p = await signUp('p@example.com');
    const id = (await book(p)).body.data.ride.id;
    world.rides[0]!.status = 'IN_PROGRESS';
    expect((await admin.post(`${A}/rides/${id}/cancel`, { reason: 'because' })).status).toBe(409);
    world.rides[0]!.status = 'COMPLETED';
    expect((await admin.post(`${A}/rides/${id}/cancel`, { reason: 'because' })).status).toBe(409);
    expect((await admin.post(`${A}/rides/nope/cancel`, { reason: 'because' })).status).toBe(404);
    expect(adminWorld.audit).toHaveLength(0);
  });

  it('lets an administrator open any ride through the shared ride endpoint', async () => {
    const admin = await makeAdmin();
    const p = await signUp('p@example.com');
    const id = (await book(p)).body.data.ride.id;
    expect((await admin.get(`/api/v1/rides/${id}`)).status).toBe(200);
  });
});

describe('vehicles', () => {
  it('lists vehicles and deactivating one stops it being matched', async () => {
    const admin = await makeAdmin();
    const p = await signUp('p@example.com');
    const d = await makeDriver('d@example.com', { ...MELROSE });
    const list = await admin.get(`${A}/vehicles?active=true`);
    expect(list.body.data.total).toBe(1);
    const vid = list.body.data.items[0].id;
    expect((await admin.patch(`${A}/vehicles/${vid}`, { isActive: false })).status).toBe(200);
    expect((await admin.get(`${A}/vehicles?active=true`)).body.data.total).toBe(0);
    const ride = (await book(p)).body.data.ride;
    expect((await p.get(`/api/v1/rides/${ride.id}`)).body.data.ride.status).toBe('SEARCHING_FOR_DRIVER');
    expect(d.state.vehicles[0]!.isActive).toBe(false);
    expect(auditActions()).toEqual(['VEHICLE_STATUS_CHANGED']);
    expect((await admin.patch(`${A}/vehicles/nope`, { isActive: true })).status).toBe(404);
  });
});

describe('categories and pricing', () => {
  it('lists the active fare configuration per category', async () => {
    const admin = await makeAdmin();
    const res = await admin.get(`${A}/pricing`);
    expect(res.body.data.items.map((p: { categoryCode: string }) => p.categoryCode)).toEqual(['ECONOMY', 'COMFORT', 'XL']);
    expect(res.body.data.items[0]).toMatchObject({ currency: 'ZAR', baseFareMinor: 1500, demandMultiplierBp: 10000 });
  });

  it('changes pricing for new estimates, and audits exactly what changed', async () => {
    const admin = await makeAdmin();
    const p = await signUp('p@example.com');
    const before = (await p.post('/api/v1/rides/estimate', { pickup: sandton, dropoff: airport })).body.data.options[0].fare.totalMinor;
    const res = await admin.patch(`${A}/pricing`, { categoryCode: 'ECONOMY', baseFareMinor: 5000, demandMultiplierBp: 12000 });
    expect(res.status).toBe(200);
    expect(res.body.data.pricing).toMatchObject({ baseFareMinor: 5000, demandMultiplierBp: 12000 });
    const after = (await p.post('/api/v1/rides/estimate', { pickup: sandton, dropoff: airport })).body.data.options[0].fare;
    expect(after.totalMinor).toBeGreaterThan(before);
    expect(after.demandAdjustmentMinor).toBeGreaterThan(0);
    expect(adminWorld.audit[0]).toMatchObject({ action: 'PRICING_UPDATED', metadata: { categoryCode: 'ECONOMY', from: { baseFareMinor: 1500, demandMultiplierBp: 10000 }, to: { baseFareMinor: 5000, demandMultiplierBp: 12000 } } });
    const other = (await p.post('/api/v1/rides/estimate', { pickup: sandton, dropoff: airport })).body.data.options[1].fare.baseFareMinor;
    expect(other).toBe(2000); // other categories untouched
  });

  it('rejects invalid pricing and changes nothing', async () => {
    const admin = await makeAdmin();
    const bad: object[] = [
      { categoryCode: 'ECONOMY', baseFareMinor: -1 }, { categoryCode: 'ECONOMY', perKmMinor: 10.5 }, { categoryCode: 'ECONOMY', demandMultiplierBp: 9000 },
      { categoryCode: 'ECONOMY', roundingMinor: 0 }, { categoryCode: 'ECONOMY', baseFareMinor: 10_000_000 }, { categoryCode: 'ECONOMY' }, { categoryCode: 'ECONOMY', currency: 'USD' }, { baseFareMinor: 100 },
    ];
    for (const b of bad) expect([b, (await admin.patch(`${A}/pricing`, b)).status]).toEqual([b, 400]);
    expect((await admin.patch(`${A}/pricing`, { categoryCode: 'HELICOPTER', baseFareMinor: 100 })).status).toBe(404);
    expect(adminWorld.audit).toHaveLength(0);
    expect(world.categories[0]!.fare.baseFareMinor).toBe(1500);
  });

  it('updates category details and audits the change', async () => {
    const admin = await makeAdmin();
    const id = world.categories[0]!.id;
    const res = await admin.patch(`${A}/categories/${id}`, { name: 'RideWave Economy Plus', capacity: 5 });
    expect(res.status).toBe(200);
    expect(res.body.data.category).toMatchObject({ name: 'RideWave Economy Plus', capacity: 5 });
    expect(adminWorld.audit[0]).toMatchObject({ action: 'CATEGORY_UPDATED', metadata: { code: 'ECONOMY', from: { name: 'RideWave Economy', capacity: 4 }, to: { name: 'RideWave Economy Plus', capacity: 5 } } });
    expect((await admin.patch(`${A}/categories/${id}`, {})).status).toBe(400);
    expect((await admin.patch(`${A}/categories/nope`, { name: 'Valid name' })).status).toBe(404);
  });
});

describe('support, reviews and the audit log', () => {
  it('lists and updates support tickets', async () => {
    const admin = await makeAdmin();
    adminWorld.tickets.push({ id: 't1', name: 'Thandi', email: 't@example.com', subject: 'Help', message: 'I need help please', status: 'OPEN', createdAt: new Date() }, { id: 't2', name: 'Sipho', email: 's@example.com', subject: 'Hi', message: 'Another message', status: 'CLOSED', createdAt: new Date() });
    expect((await admin.get(`${A}/support-tickets?status=OPEN`)).body.data.total).toBe(1);
    expect((await admin.patch(`${A}/support-tickets/t1`, { status: 'RESOLVED' })).status).toBe(200);
    expect(adminWorld.tickets[0]!.status).toBe('RESOLVED');
    expect((await admin.patch(`${A}/support-tickets/t1`, { status: 'LOST' })).status).toBe(400);
    expect((await admin.patch(`${A}/support-tickets/nope`, { status: 'OPEN' })).status).toBe(404);
  });

  it('lists reviews with a rating filter', async () => {
    const admin = await makeAdmin();
    adminWorld.reviewRows.push({ id: 'a', rideId: 'r', rating: 5, comment: 'Great', authorName: 'P', subjectName: 'D', createdAt: new Date() }, { id: 'b', rideId: 'r', rating: 2, comment: null, authorName: 'P', subjectName: 'D', createdAt: new Date() });
    expect((await admin.get(`${A}/reviews`)).body.data.total).toBe(2);
    expect((await admin.get(`${A}/reviews?rating=2`)).body.data.items[0].id).toBe('b');
    expect((await admin.get(`${A}/reviews?rating=9`)).status).toBe(400);
  });

  it('shows the audit trail newest first, filterable by action, and never includes password data', async () => {
    const admin = await makeAdmin();
    const p = await signUp('p@example.com');
    await admin.patch(`${A}/users/${p.userId}/status`, { status: 'SUSPENDED' });
    await admin.patch(`${A}/pricing`, { categoryCode: 'ECONOMY', baseFareMinor: 1600 });
    const all = await admin.get(`${A}/audit-logs`);
    expect(all.body.data.items.map((a: { action: string }) => a.action)).toEqual(['PRICING_UPDATED', 'USER_STATUS_CHANGED']);
    expect((await admin.get(`${A}/audit-logs?action=PRICING`)).body.data.total).toBe(1);
    expect(JSON.stringify(all.body)).not.toMatch(/passwordHash|SESSION/);
    expect((await admin.get(`${A}/audit-logs?pageSize=1`)).body.data.items).toHaveLength(1);
  });
});

describe('platform settings', () => {
  it('starts with built-in defaults, flagged as not overridden', async () => {
    const admin = await makeAdmin();
    const res = await admin.get(`${A}/settings`);
    expect(res.body.data).toEqual({ values: { driverCommissionBp: 2000, offerTtlSeconds: 60, searchTimeoutSeconds: 60, maxPickupRadiusMeters: 15000 }, overridden: [] });
  });

  it('changes the commission everywhere it is used, and audits before and after', async () => {
    const admin = await makeAdmin();
    const d = await makeDriver('d@example.com', { ...MELROSE });
    const p = await signUp('p@example.com');
    expect((await d.get('/api/v1/drivers/me/earnings?period=day')).body.data.commission).toEqual({ rateBp: 2000, isDemonstrationRate: true });
    const res = await admin.patch(`${A}/settings`, { driverCommissionBp: 1500 });
    expect(res.status).toBe(200);
    expect(res.body.data.overridden).toEqual(['driverCommissionBp']);
    expect(adminWorld.audit[0]).toMatchObject({ action: 'SETTINGS_UPDATED', metadata: { from: { driverCommissionBp: 2000 }, to: { driverCommissionBp: 1500 } } });
    expect((await d.get('/api/v1/drivers/me/earnings?period=day')).body.data.commission).toEqual({ rateBp: 1500, isDemonstrationRate: false });
    await book(p);
    const offer = (await d.get('/api/v1/drivers/me/ride-requests')).body.data.items[0];
    expect(offer.estimatedEarningsMinor).toBe(Math.floor(offer.estimatedFareMinor * 0.85));
  });

  it('rejects out-of-range, non-integer and unknown settings', async () => {
    const admin = await makeAdmin();
    const bad: object[] = [{ driverCommissionBp: 6000 }, { driverCommissionBp: -1 }, { offerTtlSeconds: 5 }, { searchTimeoutSeconds: 1000 }, { maxPickupRadiusMeters: 10 }, { offerTtlSeconds: 30.5 }, { secret: 1 }, {}];
    for (const b of bad) expect([b, (await admin.patch(`${A}/settings`, b)).status]).toEqual([b, 400]);
    expect(adminWorld.audit).toHaveLength(0);
  });

  it('applies the offer timeout and the pickup radius to matching', async () => {
    const admin = await makeAdmin();
    const p = await signUp('p@example.com');
    await makeDriver('d@example.com', { ...MELROSE });
    await admin.patch(`${A}/settings`, { maxPickupRadiusMeters: 1000 }); // the only driver is about 3.4 km away
    const id = (await book(p)).body.data.ride.id;
    expect((await p.get(`/api/v1/rides/${id}`)).body.data.ride.status).toBe('SEARCHING_FOR_DRIVER');
    await admin.patch(`${A}/settings`, { maxPickupRadiusMeters: 15000, offerTtlSeconds: 10 });
    expect((await p.get(`/api/v1/rides/${id}`)).body.data.ride.status).toBe('DRIVER_ASSIGNED');
    world.rides[0]!.assignedAt = new Date(Date.now() - 20_000); // 20 s with a 10 s limit
    expect((await p.get(`/api/v1/rides/${id}`)).body.data.ride.status).toBe('SEARCHING_FOR_DRIVER');
  });

  it('falls back to defaults if the settings table is unavailable (for example before the migration)', async () => {
    const admin = await makeAdmin();
    const spy = vi.spyOn(extras.settingsRepo, 'all').mockRejectedValueOnce(new Error('no such table: PlatformSetting'));
    const res = await admin.get(`${A}/settings`);
    expect(res.status).toBe(200);
    expect(res.body.data.values.offerTtlSeconds).toBe(60);
    spy.mockRestore();
  });
});
