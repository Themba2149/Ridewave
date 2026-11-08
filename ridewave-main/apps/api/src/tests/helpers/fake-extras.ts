import type { NotificationRow, NotificationsRepository } from '../../repositories/notifications.repository';
import type { PaymentsRepository } from '../../repositories/payments.repository';
import type { SettingsRepository } from '../../repositories/settings.repository';
import type { AdminPaymentRow, PaymentMethodRow, PaymentRow } from '../../types/payment';
import { AppError } from '../../utils/errors';
import { authWorld } from './fake-auth-repository';
import { world } from './fake-rides-repository';

/** In-memory stand-ins for the settings, notifications and payments repositories. */
export function createExtras() {
  let seq = 0;
  const id = (p: string) => `${p}_${++seq}`;

  // settings
  const settingsStore: Record<string, string> = {};
  const settingsRepo: SettingsRepository = {
    async all() { return { ...settingsStore }; },
    async upsertMany(entries) { Object.assign(settingsStore, entries); },
  };

  // notifications
  const notifications: Array<NotificationRow & { userId: string }> = [];
  const failure = { next: false };
  const notificationsRepo: NotificationsRepository = {
    async create(n) {
      if (failure.next) { failure.next = false; throw new Error('notification store is down'); }
      const row = { id: id('n'), userId: n.userId, type: n.type, title: n.title, body: n.body, readAt: null, createdAt: new Date() };
      notifications.push(row);
      return row;
    },
    async createMany(userIds, n) { for (const u of userIds) notifications.push({ id: id('n'), userId: u, readAt: null, createdAt: new Date(), ...n }); return userIds.length; },
    async list(userId, { page, pageSize, unreadOnly }) {
      const mine = notifications.filter((n) => n.userId === userId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : -1));
      const shown = unreadOnly ? mine.filter((n) => !n.readAt) : mine;
      return { items: shown.slice((page - 1) * pageSize, page * pageSize).map(({ userId: _u, ...r }) => (void _u, r)), total: shown.length, unread: mine.filter((n) => !n.readAt).length };
    },
    async markRead(userId, nid) { const n = notifications.find((x) => x.id === nid && x.userId === userId && !x.readAt); if (!n) return false; n.readAt = new Date(); return true; },
    async markAllRead(userId) { const m = notifications.filter((n) => n.userId === userId && !n.readAt); m.forEach((n) => { n.readAt = new Date(); }); return m.length; },
    async activeUserIds(audience) {
      return authWorld.users.filter((u) => u.status === 'ACTIVE' && (audience === 'ALL' ? u.role !== 'ADMIN' : u.role === audience)).map((u) => u.id);
    },
  };

  // payments
  const payments: PaymentRow[] = [];
  const events: Array<{ paymentId: string; type: string; fromStatus: string | null; toStatus: string; detail: string | null }> = [];
  const keys = new Set<string>();
  const methods: Array<PaymentMethodRow & { passengerId: string }> = [];
  const participants = (rideId: string) => { const r = world.rides.find((x) => x.id === rideId); return { passengerUserId: r?.passengerUserId ?? '', driverUserId: r?.driverUserId ?? null }; };
  const paymentsRepo: PaymentsRepository = {
    async findByRide(rideId) { return payments.filter((p) => p.rideId === rideId).reverse(); },
    async getById(pid) { const p = payments.find((x) => x.id === pid); return p ? { ...p, ...participants(p.rideId) } : null; },
    async create(i) {
      if (keys.has(i.idempotencyKey)) throw AppError.conflict('A payment for this ride was already started.');
      keys.add(i.idempotencyKey);
      const now = new Date();
      const p: PaymentRow = { id: id('pay'), rideId: i.rideId, method: i.method, status: i.status, amountMinor: i.amountMinor, currency: i.currency, provider: i.provider, transactionRef: i.transactionRef ?? null, failureReason: null, description: i.description, createdAt: now, updatedAt: now, ...participants(i.rideId) };
      payments.push(p);
      events.push({ paymentId: p.id, type: 'CREATED', fromStatus: null, toStatus: i.status, detail: i.description });
      return p;
    },
    async update(pid, data, event) {
      const p = payments.find((x) => x.id === pid)!;
      events.push({ paymentId: pid, type: event.type, fromStatus: p.status, toStatus: data.status, detail: event.detail ?? null });
      p.status = data.status; p.updatedAt = new Date();
      if (data.transactionRef) p.transactionRef = data.transactionRef;
      if (data.failureReason !== undefined) p.failureReason = data.failureReason;
      return { ...p, ...participants(p.rideId) };
    },
    async listAll({ status, method, page, pageSize }) {
      const rows: AdminPaymentRow[] = payments.filter((p) => (!status || p.status === status) && (!method || p.method === method)).reverse().map((p) => ({
        id: p.id, rideId: p.rideId, passengerName: authWorld.users.find((u) => u.id === participants(p.rideId).passengerUserId)?.fullName ?? '?', method: p.method, status: p.status,
        amountMinor: p.amountMinor, currency: p.currency, provider: p.provider, transactionRef: p.transactionRef, failureReason: p.failureReason, createdAt: p.createdAt,
      }));
      return { items: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length };
    },
    async summary() {
      const counts: Record<string, number> = {};
      for (const p of payments) counts[p.status] = (counts[p.status] ?? 0) + 1;
      return { succeededMinor: payments.filter((p) => p.status === 'SUCCEEDED').reduce((s, p) => s + p.amountMinor, 0), pendingMinor: payments.filter((p) => p.status === 'PENDING' || p.status === 'PROCESSING').reduce((s, p) => s + p.amountMinor, 0), counts };
    },
    async listMethods(pid) { return methods.filter((m) => m.passengerId === pid).map(({ passengerId: _p, ...m }) => (void _p, m)); },
    async getMethod(pid, mid) { const m = methods.find((x) => x.id === mid && x.passengerId === pid); if (!m) return null; const { passengerId: _p, ...rest } = m; void _p; return rest; },
    async createMethod(pid, data) {
      const makeDefault = data.isDefault || !methods.some((m) => m.passengerId === pid);
      if (makeDefault) methods.filter((m) => m.passengerId === pid).forEach((m) => { m.isDefault = false; });
      const row = { id: id('pm'), passengerId: pid, createdAt: new Date(), ...data, isDefault: makeDefault };
      methods.push(row);
      const { passengerId: _p, ...rest } = row; void _p;
      return rest;
    },
    async deleteMethod(pid, mid) { const i = methods.findIndex((m) => m.id === mid && m.passengerId === pid); if (i < 0) return false; methods.splice(i, 1); return true; },
    async setDefaultMethod(pid, mid) {
      if (!methods.some((m) => m.id === mid && m.passengerId === pid)) return false;
      methods.filter((m) => m.passengerId === pid).forEach((m) => { m.isDefault = m.id === mid; });
      return true;
    },
  };
  world.hooks.paymentFor = (rideId) => { const p = [...payments].reverse().find((x) => x.rideId === rideId && x.status !== 'FAILED') ?? [...payments].reverse().find((x) => x.rideId === rideId); return p ? { method: p.method, status: p.status } : null; };

  const reset = () => {
    for (const k of Object.keys(settingsStore)) delete settingsStore[k];
    notifications.length = 0; payments.length = 0; events.length = 0; keys.clear(); methods.length = 0; failure.next = false;
  };
  return { settingsRepo, notificationsRepo, paymentsRepo, settingsStore, notifications, payments, events, methods, failure, reset };
}
export const extras = createExtras();
