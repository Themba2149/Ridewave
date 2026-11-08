import { beforeEach, describe, expect, it, vi } from 'vitest';
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

const { signUp, makeDriver, makeAdmin, completedRide } = kit(createApp());
const P = '/api/v1/passengers/me/payment-methods';
const card = (over: object = {}) => ({ type: 'CARD', label: 'Visa', last4: '4242', ...over });

beforeEach(() => {
  for (const arr of [authWorld.users, authWorld.sessions, authWorld.resets]) arr.length = 0;
  world.reset();
});

describe('saved payment methods', () => {
  it('stores a label and last four digits only, never returns the provider token, and makes the first one the default', async () => {
    const p = await signUp('p@example.com');
    const res = await p.post(P, card());
    expect(res.status).toBe(201);
    expect(res.body.data.method).toMatchObject({ type: 'CARD', label: 'Visa', last4: '4242', isDefault: true });
    expect(JSON.stringify(res.body)).not.toMatch(/dev_tok|providerToken/);
    expect(extras.methods[0]!.providerToken).toMatch(/^dev_tok_/); // the token is kept server-side only
    const second = await p.post(P, card({ label: 'Second', last4: '1111', isDefault: true }));
    const list = (await p.get(P)).body.data.items;
    expect(list.find((m: { id: string }) => m.id === second.body.data.method.id).isDefault).toBe(true);
    expect(list.filter((m: { isDefault: boolean }) => m.isDefault)).toHaveLength(1);
  });

  it('refuses full card numbers, CVVs and any unknown field, and stores nothing', async () => {
    const p = await signUp('p@example.com');
    const bad: object[] = [
      card({ last4: '4242424242424242' }), card({ last4: '42' }), card({ last4: undefined }), card({ cardNumber: '4242424242424242' }), card({ cvv: '123' }),
      card({ label: '4242 4242 4242 4242', last4: '4242424242424242' }), { type: 'CASH', label: 'Cash' }, card({ type: 'BITCOIN' }),
    ];
    for (const b of bad) expect([b, (await p.post(P, b)).status]).toEqual([b, 400]);
    expect(extras.methods).toHaveLength(0);
  });

  it('is owner-scoped: other passengers cannot see, change or delete your methods', async () => {
    const a = await signUp('a@example.com');
    const b = await signUp('b@example.com');
    const id = (await a.post(P, card())).body.data.method.id;
    expect((await b.get(P)).body.data.items).toHaveLength(0);
    expect((await b.del(`${P}/${id}`)).status).toBe(404);
    expect((await b.patch(`${P}/${id}/default`, {})).status).toBe(404);
    expect((await a.del(`${P}/${id}`)).status).toBe(200);
    expect((await (await makeDriver('d@example.com')).get(P)).status).toBe(403);
  });
});

describe('paying for a ride', () => {
  async function setup() {
    const p = await signUp('p@example.com');
    const d = await makeDriver('d@example.com');
    const methodId = async (last4 = '4242', type = 'CARD') => (await p.post(P, { type, label: 'Test', ...(type === 'CARD' ? { last4 } : {}) })).body.data.method.id as string;
    return { p, d, methodId };
  }
  const pay = (p: Awaited<ReturnType<typeof signUp>>, rideId: string, method: string, paymentMethodId?: string) => p.post('/api/v1/payments/checkout', { rideId, method, ...(paymentMethodId ? { paymentMethodId } : {}) });

  it('only allows payment after completion, by the passenger who rode', async () => {
    const { p, d, methodId } = await setup();
    const m = await methodId();
    const rideId = (await p.post('/api/v1/rides', { pickup: { address: 'Sandton City, Rivonia Rd, Sandton', lat: -26.1076, lng: 28.0567 }, dropoff: { address: 'OR Tambo International Airport, Kempton Park', lat: -26.1337, lng: 28.242 }, categoryCode: 'ECONOMY', idempotencyKey: 'early-pay-key-1' })).body.data.ride.id;
    expect((await pay(p, rideId, 'CARD', m)).status).toBe(409); // not completed yet
    for (const step of ['accept', 'arrive', 'start', 'complete']) await d.post(`/api/v1/rides/${rideId}/${step}`);
    const other = await signUp('o@example.com');
    expect((await pay(other, rideId, 'CASH')).status).toBe(404);
    expect((await d.post('/api/v1/payments/checkout', { rideId, method: 'CASH' })).status).toBe(403);
    expect((await pay(p, rideId, 'CARD', m)).status).toBe(201);
  });

  it('charges the final fare through the simulated provider and says so everywhere', async () => {
    const { p, d, methodId } = await setup();
    const rideId = await completedRide(p, d);
    const res = await pay(p, rideId, 'CARD', await methodId());
    expect(res.status).toBe(201);
    const payment = res.body.data.payment;
    const ride = world.rides.find((r) => r.id === rideId)!;
    expect(payment).toMatchObject({ method: 'CARD', status: 'SUCCEEDED', provider: 'dev', isSimulated: true, amountMinor: ride.finalFareMinor });
    expect(payment.transactionRef).toMatch(/^dev_txn_/);
    expect(payment.description).toMatch(/simulated, no real money moves/);
    expect(extras.events.filter((e) => e.paymentId === payment.id).map((e) => e.type)).toEqual(['CREATED', 'CHARGE_SUCCEEDED']);
    expect(extras.notifications.some((n) => n.userId === p.userId && /Payment received \(simulated\)/.test(n.title))).toBe(true);
    expect((await p.get(`/api/v1/rides/${rideId}`)).body.data.ride.payment).toMatchObject({ method: 'CARD', status: 'SUCCEEDED', isSimulated: true });
    expect((await p.get(`/api/v1/rides/${rideId}/receipt`)).body.data.payment).toMatchObject({ status: 'SUCCEEDED', isSimulated: true });
  });

  it('never charges twice: a repeated or simultaneous request returns the same payment', async () => {
    const { p, d, methodId } = await setup();
    const rideId = await completedRide(p, d);
    const m = await methodId();
    const [a, b] = await Promise.all([pay(p, rideId, 'CARD', m), pay(p, rideId, 'CARD', m)]);
    expect(a.body.data.payment.id).toBe(b.body.data.payment.id);
    expect([a.body.data.duplicate, b.body.data.duplicate].sort()).toEqual([false, true]);
    const again = await pay(p, rideId, 'CARD', m);
    expect(again.status).toBe(200);
    expect(again.body.data.duplicate).toBe(true);
    expect(extras.payments).toHaveLength(1);
    expect(extras.events.filter((e) => e.type.startsWith('CHARGE_'))).toHaveLength(1);
  });

  it('records a declined card as FAILED with a reason, then lets the passenger try another method', async () => {
    const { p, d, methodId } = await setup();
    const rideId = await completedRide(p, d);
    const failed = await pay(p, rideId, 'CARD', await methodId('0002'));
    expect(failed.body.data.payment).toMatchObject({ status: 'FAILED', failureReason: 'The card was declined (simulated).' });
    expect(extras.notifications.some((n) => n.title === 'Payment failed')).toBe(true);
    expect((await p.get(`/api/v1/rides/${rideId}`)).body.data.ride.payment.status).toBe('FAILED');
    const retry = await pay(p, rideId, 'CARD', await methodId('4242'));
    expect(retry.status).toBe(201);
    expect(retry.body.data.payment.status).toBe('SUCCEEDED');
    expect(retry.body.data.payment.id).not.toBe(failed.body.data.payment.id);
    expect(extras.payments).toHaveLength(2);
    expect((await p.get(`/api/v1/rides/${rideId}/receipt`)).body.data.payment.status).toBe('SUCCEEDED');
  });

  it('keeps a pending payment pending until the provider confirms, settles it once, and records the event', async () => {
    const { p, d, methodId } = await setup();
    const rideId = await completedRide(p, d);
    const res = await pay(p, rideId, 'CARD', await methodId('0005'));
    const id = res.body.data.payment.id;
    expect(res.body.data.payment.status).toBe('PENDING');
    expect((await p.get(`/api/v1/payments/${id}`)).body.data.payment.status).toBe('PENDING'); // too early
    extras.payments[0]!.createdAt = new Date(Date.now() - 20_000);
    expect((await p.get(`/api/v1/payments/${id}`)).body.data.payment.status).toBe('SUCCEEDED');
    await p.get(`/api/v1/payments/${id}`);
    expect(extras.events.filter((e) => e.type === 'SETTLED_SUCCEEDED')).toHaveLength(1);
    expect((await pay(p, rideId, 'CARD', await methodId())).body.data.duplicate).toBe(true);
  });

  it('treats cash as unpaid until the driver confirms receiving it', async () => {
    const { p, d } = await setup();
    const rideId = await completedRide(p, d);
    expect((await d.post(`/api/v1/rides/${rideId}/cash-received`)).status).toBe(409); // passenger has not chosen cash
    const res = await pay(p, rideId, 'CASH');
    expect(res.body.data.payment).toMatchObject({ method: 'CASH', status: 'PENDING', provider: 'cash', isSimulated: false });
    expect(extras.notifications.some((n) => n.userId === d.userId && n.title === 'Passenger will pay cash')).toBe(true);
    expect((await d.get('/api/v1/drivers/me/rides?scope=past')).body.data.items[0].payment).toEqual({ method: 'CASH', status: 'PENDING' });

    const stranger = await makeDriver('x@example.com');
    expect((await p.post(`/api/v1/rides/${rideId}/cash-received`)).status).toBe(403); // passengers cannot mark themselves paid
    expect((await stranger.post(`/api/v1/rides/${rideId}/cash-received`)).status).toBe(404);
    expect(extras.payments[0]!.status).toBe('PENDING');

    const ok = await d.post(`/api/v1/rides/${rideId}/cash-received`);
    expect(ok.status).toBe(200);
    expect(ok.body.data.payment.status).toBe('SUCCEEDED');
    expect(extras.events.map((e) => e.type)).toContain('CASH_CONFIRMED');
    expect((await d.post(`/api/v1/rides/${rideId}/cash-received`)).status).toBe(409);
    expect((await pay(p, rideId, 'CASH')).body.data.duplicate).toBe(true);
  });

  it('rejects methods that are not yours, the wrong type, or missing', async () => {
    const { p, d, methodId } = await setup();
    const other = await signUp('o@example.com');
    const theirs = (await other.post(P, card())).body.data.method.id;
    const rideId = await completedRide(p, d);
    expect((await pay(p, rideId, 'CARD', theirs)).status).toBe(400);
    expect((await pay(p, rideId, 'CARD', 'nope')).status).toBe(400);
    expect((await pay(p, rideId, 'DIGITAL_WALLET', await methodId())).status).toBe(400); // a card is not a wallet
    expect((await p.post('/api/v1/payments/checkout', { rideId, method: 'CARD' })).status).toBe(400);
    expect((await p.post('/api/v1/payments/checkout', { rideId, method: 'CASH', amountMinor: 1 })).status).toBe(400); // the client never sends an amount
    expect(extras.payments).toHaveLength(0);
  });

  it('lets only participants and administrators read a payment; the driver sees a summary without references', async () => {
    const { p, d, methodId } = await setup();
    const rideId = await completedRide(p, d);
    const id = (await pay(p, rideId, 'CARD', await methodId())).body.data.payment.id;
    const admin = await makeAdmin();
    expect((await p.get(`/api/v1/payments/${id}`)).body.data.payment.transactionRef).toMatch(/^dev_txn_/);
    expect((await admin.get(`/api/v1/payments/${id}`)).status).toBe(200);
    const asDriver = await d.get(`/api/v1/payments/${id}`);
    expect(asDriver.status).toBe(200);
    expect(asDriver.body.data.payment).toEqual({ id, method: 'CARD', status: 'SUCCEEDED', isSimulated: true });
    expect((await (await signUp('o@example.com')).get(`/api/v1/payments/${id}`)).status).toBe(404);
    expect((await (await makeDriver('x@example.com')).get(`/api/v1/payments/${id}`)).status).toBe(404);
  });

  it('shows administrators every payment with totals, filterable, and flags that nothing is real', async () => {
    const { p, d, methodId } = await setup();
    const admin = await makeAdmin();
    const rideId = await completedRide(p, d);
    await pay(p, rideId, 'CARD', await methodId('0002'));
    await pay(p, rideId, 'CARD', await methodId());
    const all = await admin.get('/api/v1/admin/payments');
    expect(all.status).toBe(200);
    expect(all.body.data.total).toBe(2);
    expect(all.body.data.summary).toMatchObject({ counts: { FAILED: 1, SUCCEEDED: 1 } });
    expect(all.body.data.summary.succeededMinor).toBe(world.rides[0]!.finalFareMinor);
    expect(all.body.data.note).toMatch(/simulated provider/);
    expect((await admin.get('/api/v1/admin/payments?status=FAILED')).body.data.total).toBe(1);
    expect((await admin.get('/api/v1/admin/payments?status=NOPE')).status).toBe(400);
    expect((await p.get('/api/v1/admin/payments')).status).toBe(403);
  });
});
