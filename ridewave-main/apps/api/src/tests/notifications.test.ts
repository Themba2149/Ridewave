import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminWorld } from './helpers/fake-admin-repository';
import { authWorld } from './helpers/fake-auth-repository';
import { extras } from './helpers/fake-extras';
import { world } from './helpers/fake-rides-repository';
import { kit } from './helpers/kit';

vi.mock('../config/database', () => ({ prisma: { $queryRaw: vi.fn() } }));
vi.mock('../repositories/auth.repository', async () => ({ authRepository: (await import('./helpers/fake-auth-repository')).authWorld.repo }));
vi.mock('../repositories/rides.repository', async () => ({ ridesRepository: (await import('./helpers/fake-rides-repository')).world.ridesRepo }));
vi.mock('../repositories/drivers.repository', async () => ({ driversRepository: (await import('./helpers/fake-rides-repository')).world.driversRepo }));
vi.mock('../repositories/admin.repository', async () => ({ adminRepository: (await import('./helpers/fake-admin-repository')).adminWorld.repo }));

import { createApp } from '../app';

const { signUp, makeDriver, makeAdmin, book, completedRide } = kit(createApp());
const titles = (userId: string) => extras.notifications.filter((n) => n.userId === userId).map((n) => n.title);

beforeEach(() => {
  for (const arr of [authWorld.users, authWorld.sessions, authWorld.resets]) arr.length = 0;
  world.reset();
  adminWorld.reset();
});

describe('notifications from ride events', () => {
  it('tells the right person at each step of a ride', async () => {
    const p = await signUp('p@example.com');
    const d = await makeDriver('d@example.com');
    const id = (await book(p)).body.data.ride.id;
    expect(titles(d.userId)).toEqual(['New ride request']);
    expect(titles(p.userId)).toEqual([]);
    await d.post(`/api/v1/rides/${id}/accept`);
    await d.post(`/api/v1/rides/${id}/arrive`);
    await d.post(`/api/v1/rides/${id}/start`);
    await d.post(`/api/v1/rides/${id}/complete`);
    expect(titles(p.userId)).toEqual(['Your driver is on the way', 'Your driver has arrived', 'Trip started', 'Trip completed']);
    expect(extras.notifications.find((n) => n.title === 'Trip completed')!.body).toMatch(/Fare R\d+\.\d{2}/);
  });

  it('tells the driver when the passenger cancels, and the passenger when no driver is found', async () => {
    const p = await signUp('p@example.com');
    const d = await makeDriver('d@example.com');
    const id = (await book(p)).body.data.ride.id;
    await d.post(`/api/v1/rides/${id}/accept`);
    await p.post(`/api/v1/rides/${id}/cancel`, {});
    expect(titles(d.userId)).toContain('Ride cancelled');

    const lonely = await signUp('q@example.com');
    const r2 = (await book(lonely, { pickup: { address: 'OR Tambo International Airport, Kempton Park', lat: -26.1337, lng: 28.242 }, dropoff: { address: 'Sandton City, Rivonia Rd, Sandton', lat: -26.1076, lng: 28.0567 } })).body.data.ride.id; // beyond the driver's 15 km radius
    for (const h of world.rides.find((r) => r.id === r2)!.statusHistory) h.createdAt = new Date(Date.now() - 5 * 60_000);
    await lonely.get(`/api/v1/rides/${r2}`);
    expect(titles(lonely.userId)).toContain('No driver available');
  });

  it('never lets a notification failure break the ride', async () => {
    const p = await signUp('p@example.com');
    await makeDriver('d@example.com');
    extras.failure.next = true; // the next notification write will throw
    const res = await book(p);
    expect(res.status).toBe(201);
    expect(world.rides).toHaveLength(1);
  });
});

describe('notification inbox', () => {
  it('lists only your own notifications with an unread count, pages, filters, and marks read', async () => {
    const p = await signUp('p@example.com');
    const d = await makeDriver('d@example.com');
    const other = await signUp('o@example.com');
    await completedRide(p, d); // 4 notifications for the passenger
    const list = await p.get('/api/v1/notifications?pageSize=3');
    expect(list.body.data).toMatchObject({ total: 4, unread: 4, page: 1, pageSize: 3 });
    expect(list.body.data.items).toHaveLength(3);
    expect((await other.get('/api/v1/notifications')).body.data.total).toBe(0);

    const first = list.body.data.items[0].id;
    expect((await other.post(`/api/v1/notifications/${first}/read`)).status).toBe(404); // not yours
    expect((await p.post(`/api/v1/notifications/${first}/read`)).status).toBe(200);
    expect((await p.post(`/api/v1/notifications/${first}/read`)).status).toBe(404); // already read
    expect((await p.get('/api/v1/notifications')).body.data.unread).toBe(3);
    expect((await p.get('/api/v1/notifications?unread=true')).body.data.total).toBe(3);
    expect((await p.post('/api/v1/notifications/read-all')).body.data.updated).toBe(3);
    expect((await p.get('/api/v1/notifications')).body.data.unread).toBe(0);
    expect((await p.get('/api/v1/notifications?pageSize=500')).status).toBe(400);
  });

  it('requires sign-in', async () => {
    const anon = await import('supertest').then((m) => m.default(createApp()).get('/api/v1/notifications'));
    expect(anon.status).toBe(401);
  });
});

describe('administrator announcements', () => {
  it('sends to the chosen audience only, and records who sent what to how many', async () => {
    const admin = await makeAdmin();
    const p1 = await signUp('p1@example.com');
    await signUp('p2@example.com');
    const d = await makeDriver('d@example.com');
    const res = await admin.post('/api/v1/admin/notifications', { audience: 'PASSENGER', title: 'Weekend promo', body: 'Demonstration announcement' });
    expect(res.status).toBe(201);
    expect(res.body.data.sent).toBe(2);
    expect(titles(p1.userId)).toEqual(['Weekend promo']);
    expect(titles(d.userId)).toEqual([]);
    expect(titles(admin.userId)).toEqual([]);
    expect(adminWorld.audit[0]).toMatchObject({ action: 'ANNOUNCEMENT_SENT', actorEmail: 'boss@example.com', metadata: { audience: 'PASSENGER', title: 'Weekend promo', recipients: 2 } });
    expect((await admin.post('/api/v1/admin/notifications', { audience: 'ALL', title: 'Hi all', body: 'Everyone' })).body.data.sent).toBe(3);
  });

  it('skips suspended users and validates input; passengers cannot send', async () => {
    const admin = await makeAdmin();
    const p = await signUp('p@example.com');
    authWorld.users.find((u) => u.id === p.userId)!.status = 'SUSPENDED';
    expect((await admin.post('/api/v1/admin/notifications', { audience: 'PASSENGER', title: 'Hello', body: 'Anyone there?' })).body.data.sent).toBe(0);
    for (const bad of [{ audience: 'EVERYONE', title: 'Hello', body: 'Hello' }, { audience: 'ALL', title: 'x', body: 'Hello' }, { audience: 'ALL', title: 'Hello', body: 'x'.repeat(501) }, { audience: 'ALL', title: 'Hello', body: 'Hello', html: '<b>' }]) {
      expect((await admin.post('/api/v1/admin/notifications', bad)).status).toBe(400);
    }
    const q = await signUp('q@example.com');
    expect((await q.post('/api/v1/admin/notifications', { audience: 'ALL', title: 'Hello', body: 'Spam' })).status).toBe(403);
  });
});
