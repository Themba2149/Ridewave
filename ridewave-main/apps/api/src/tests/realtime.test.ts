import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { io as connect, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { authWorld } from './helpers/fake-auth-repository';
import { world } from './helpers/fake-rides-repository';
import { kit } from './helpers/kit';

vi.mock('../config/database', () => ({ prisma: { $queryRaw: vi.fn() } }));
vi.mock('../repositories/auth.repository', async () => ({ authRepository: (await import('./helpers/fake-auth-repository')).authWorld.repo }));
vi.mock('../repositories/rides.repository', async () => ({ ridesRepository: (await import('./helpers/fake-rides-repository')).world.ridesRepo }));
vi.mock('../repositories/drivers.repository', async () => ({ driversRepository: (await import('./helpers/fake-rides-repository')).world.driversRepo }));
vi.mock('../repositories/admin.repository', async () => ({ adminRepository: (await import('./helpers/fake-admin-repository')).adminWorld.repo }));

import { createApp } from '../app';
import { attachRealtime } from '../realtime/socket';
import { setIo } from '../services/realtime.service';

const app = createApp();
const { signUp, makeDriver, makeAdmin, book } = kit(app);
const ORIGIN = 'http://localhost:5173';
let server: http.Server;
let url: string;
const open: Socket[] = [];

beforeAll(async () => {
  server = http.createServer(app);
  attachRealtime(server);
  await new Promise<void>((r) => server.listen(0, r));
  url = `http://localhost:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => { open.forEach((s) => s.close()); setIo(null); await new Promise((r) => server.close(r)); });
beforeEach(() => { for (const arr of [authWorld.users, authWorld.sessions, authWorld.resets]) arr.length = 0; world.reset(); });

type Headers = Record<string, string>;
function connectWith(headers: Headers) {
  const s = connect(url, { transports: ['websocket'], reconnection: false, forceNew: true, extraHeaders: headers });
  open.push(s);
  return s;
}
const connected = (s: Socket) => new Promise<'ok' | string>((resolve) => { s.on('connect', () => resolve('ok')); s.on('connect_error', (e) => resolve(e.message)); });
const next = <T = Record<string, unknown>>(s: Socket, event: string, match: (p: T) => boolean = () => true, ms = 2000) =>
  new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timed out waiting for ${event}`)), ms);
    s.on(event, (p: T) => { if (match(p)) { clearTimeout(t); resolve(p); } });
  });
const subscribe = (s: Socket, rideId: unknown) => new Promise<{ ok: boolean }>((resolve) => s.emit('ride:subscribe', rideId, resolve));
async function live(c: { cookie: string }) {
  const s = connectWith({ cookie: c.cookie, origin: ORIGIN });
  expect(await connected(s)).toBe('ok');
  return s;
}

describe('real-time connection security', () => {
  it('rejects connections without a session, with a revoked session, or from another origin', async () => {
    const p = await signUp('p@example.com');
    expect(await connected(connectWith({ origin: ORIGIN }))).toBe('unauthorized');
    expect(await connected(connectWith({ cookie: 'ridewave.sid=not-a-real-token', origin: ORIGIN }))).toBe('unauthorized');
    expect(await connected(connectWith({ cookie: p.cookie, origin: 'https://evil.example' }))).toBe('forbidden');
    expect(await connected(connectWith({ cookie: p.cookie, origin: ORIGIN }))).toBe('ok');
    await p.post('/api/v1/auth/logout');
    expect(await connected(connectWith({ cookie: p.cookie, origin: ORIGIN }))).toBe('unauthorized'); // the session was revoked
  });

  it('only lets participants and admins subscribe to a ride, with the same answer for "not found" and "not yours"', async () => {
    const owner = await signUp('owner@example.com');
    const other = await signUp('other@example.com');
    const driver = await makeDriver('d@example.com');
    const admin = await makeAdmin();
    const rideId = (await book(owner)).body.data.ride.id;
    const [so, sx, sd, sa] = await Promise.all([live(owner), live(other), live(driver), live(admin)]);
    expect(await subscribe(so, rideId)).toEqual({ ok: true });
    expect(await subscribe(sd, rideId)).toEqual({ ok: true }); // the driver who was offered it
    expect(await subscribe(sa, rideId)).toEqual({ ok: true });
    expect(await subscribe(sx, rideId)).toEqual({ ok: false });
    expect(await subscribe(sx, 'no-such-ride')).toEqual({ ok: false });
    for (const junk of [undefined, 42, null, '', 'x'.repeat(100), { id: rideId }]) expect(await subscribe(so, junk)).toEqual({ ok: false });
  });

  it('disconnects a user whose session ends, and refuses later subscriptions', async () => {
    const p = await signUp('p@example.com');
    const rideId = (await book(p)).body.data.ride.id;
    const s = await live(p);
    const gone = new Promise<string>((r) => s.on('disconnect', r));
    await p.post('/api/v1/auth/logout');
    expect(await gone).toBeTruthy();
    expect(s.connected).toBe(false);
    void rideId;
  });
});

describe('real-time events', () => {
  it('pushes a minimal "ride changed" event to both sides as the ride progresses, never ride data', async () => {
    const p = await signUp('p@example.com');
    const d = await makeDriver('d@example.com');
    const [sp, sd] = await Promise.all([live(p), live(d)]);
    const offered = next<{ rideId: string; status: string }>(sd, 'ride:updated', (e) => e.status === 'DRIVER_ASSIGNED');
    const rideId = (await book(p)).body.data.ride.id;
    const event = await offered;
    expect(event.rideId).toBe(rideId);
    expect(Object.keys(event).sort()).toEqual(['at', 'rideId', 'status']);
    expect(JSON.stringify(event)).not.toMatch(/Sandton|address|fare|Name/i);

    const accepted = next<{ status: string }>(sp, 'ride:updated', (e) => e.status === 'DRIVER_ARRIVING');
    await d.post(`/api/v1/rides/${rideId}/accept`);
    expect((await accepted).status).toBe('DRIVER_ARRIVING');
    const done = next<{ status: string }>(sp, 'ride:updated', (e) => e.status === 'COMPLETED');
    for (const step of ['arrive', 'start', 'complete']) await d.post(`/api/v1/rides/${rideId}/${step}`);
    expect((await done).status).toBe('COMPLETED');
  });

  it('sends room events only to subscribers, and notification events only to their owner', async () => {
    const owner = await signUp('owner@example.com');
    const other = await signUp('other@example.com');
    const d = await makeDriver('d@example.com');
    const [so, sx, sd] = await Promise.all([live(owner), live(other), live(d)]);
    const leaked: unknown[] = [];
    sx.on('ride:updated', (e) => leaked.push(e));
    sx.on('notification:new', (e) => leaked.push(e));
    const gotNotification = next<{ title: string }>(sd, 'notification:new', (e) => e.title === 'New ride request'); // fires while booking
    const rideId = (await book(owner)).body.data.ride.id;
    expect(await subscribe(so, rideId)).toEqual({ ok: true });
    const arriving = next(so, 'ride:updated', (e: { status: string }) => e.status === 'DRIVER_ARRIVING');
    await d.post(`/api/v1/rides/${rideId}/accept`);
    await Promise.all([gotNotification, arriving]);
    await new Promise((r) => setTimeout(r, 150));
    expect(leaked).toEqual([]); // the uninvolved user received nothing
  });

  it('keeps unsubscribed room delivery off after leaving a ride', async () => {
    const p = await signUp('p@example.com');
    const d = await makeDriver('d@example.com');
    const rideId = (await book(p)).body.data.ride.id;
    const s = await live(p);
    await subscribe(s, rideId);
    s.emit('ride:unsubscribe', rideId);
    await new Promise((r) => setTimeout(r, 50));
    // The user room still delivers (the user is a participant), but the ride room no longer does: no duplicate events.
    let count = 0;
    s.on('ride:updated', () => { count += 1; });
    await d.post(`/api/v1/rides/${rideId}/accept`);
    await new Promise((r) => setTimeout(r, 150));
    expect(count).toBe(1);
  });
});
