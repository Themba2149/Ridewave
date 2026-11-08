import fs from 'node:fs/promises';
import { adminRepository as admin } from '../repositories/admin.repository';
import { authRepository as users } from '../repositories/auth.repository';
import { ridesRepository as rides } from '../repositories/rides.repository';
import type { UserRecord } from '../types/auth';
import type { PricingFields } from '../types/admin';
import { AppError } from '../utils/errors';
import { DAY_MS, localDate, startOfLocalDay } from '../utils/time';
import { documentPath, openDocument } from './storage.service';
import { toPublicUser } from './auth.service';
import { publishRideChange } from './ride-events.service';
import { disconnectUser } from './realtime.service';
import { PASSENGER_CANCELLABLE, assertTransition } from './ride-state';

type Ctx = { actor: UserRecord; ip?: string };
const audit = (c: Ctx, action: string, entityType: string, entityId: string | null, metadata?: Record<string, unknown>) =>
  admin.recordAudit({ actorId: c.actor.id, action, entityType, entityId, metadata, ipAddress: c.ip ?? null });

const diff = <T extends object>(before: T, changes: Partial<T>) => {
  const from: Record<string, unknown> = {};
  const to: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(changes)) {
    if (v !== undefined && (before as Record<string, unknown>)[k] !== v) { from[k] = (before as Record<string, unknown>)[k]; to[k] = v; }
  }
  return { from, to };
};

// ---- analytics (every figure comes from database records) ----
export async function getAnalytics(days: number, now = Date.now()) {
  const windowStart = startOfLocalDay(now) - (days - 1) * DAY_MS;
  const [overview, stamps, recentRides, topDrivers] = await Promise.all([admin.overview(), admin.ridesSince(new Date(windowStart)), admin.recentRides(8), admin.topDrivers(5)]);

  const buckets = new Map<string, { date: string; requested: number; completed: number; cancelled: number; revenueMinor: number }>();
  for (let t = windowStart; t <= now; t += DAY_MS) buckets.set(localDate(t), { date: localDate(t), requested: 0, completed: 0, cancelled: 0, revenueMinor: 0 });
  for (const r of stamps) {
    const requested = buckets.get(localDate(r.requestedAt.getTime()));
    if (requested && r.requestedAt.getTime() >= windowStart) { requested.requested += 1; if (r.status === 'CANCELLED') requested.cancelled += 1; }
    if (r.status === 'COMPLETED' && r.completedAt) {
      const done = buckets.get(localDate(r.completedAt.getTime()));
      if (done && r.completedAt.getTime() >= windowStart) { done.completed += 1; done.revenueMinor += r.finalFareMinor ?? 0; }
    }
  }
  return {
    generatedAt: new Date(now), days, overview, volume: [...buckets.values()], recentRides, topDrivers,
    notes: {
      revenue: 'Sum of final fares of completed rides. Payments are not recorded yet, so this is not money received.',
      volume: 'Requested and cancelled rides are counted on the day they were requested; completed rides on the day they finished.',
    },
  };
}

// ---- users ----
export async function setUserStatus(c: Ctx, userId: string, input: { status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED'; reason?: string }) {
  if (userId === c.actor.id) throw AppError.forbidden('You cannot change your own account status.');
  const target = await users.findUserById(userId);
  if (!target) throw AppError.notFound('User not found.');
  const { status: fromStatus, email } = target; // capture before updating
  const updated = await users.setUserStatus(userId, input.status);
  if (!updated) throw AppError.notFound('User not found.');
  if (input.status !== 'ACTIVE') {
    await users.revokeUserSessions(userId); // sign them out immediately
    await admin.setDriverOfflineByUser(userId); // and stop dispatching to them
    disconnectUser(userId); // and close any live connections
  }
  await audit(c, 'USER_STATUS_CHANGED', 'User', userId, { from: fromStatus, to: input.status, reason: input.reason, email });
  return toPublicUser(updated);
}

// ---- drivers, documents, vehicles ----
export async function setDriverApproval(c: Ctx, driverId: string, input: { status: string; note?: string }) {
  const before = await admin.getDriver(driverId);
  if (!before) throw AppError.notFound('Driver not found.');
  const { approvalStatus: fromStatus, email } = before;
  const updated = await admin.setDriverApproval(driverId, input);
  if (!updated) throw AppError.notFound('Driver not found.');
  await audit(c, 'DRIVER_APPROVAL_CHANGED', 'DriverProfile', driverId, { from: fromStatus, to: input.status, note: input.note, driver: email });
  return updated;
}

export async function reviewDocument(c: Ctx, documentId: string, input: { status: string; note?: string }) {
  const doc = await admin.getDocument(documentId);
  if (!doc) throw AppError.notFound('Document not found.');
  const { type, status: fromStatus } = doc;
  const updated = await admin.setDocumentReview(documentId, input);
  if (!updated) throw AppError.notFound('Document not found.');
  await audit(c, 'DOCUMENT_REVIEWED', 'DriverDocument', documentId, { type, from: fromStatus, to: input.status, note: input.note });
  return updated;
}

/** Streams a private document to an administrator. Every access is audited, including who opened which file. */
export async function openDocumentForReview(c: Ctx, documentId: string) {
  const doc = await admin.getDocument(documentId);
  if (!doc) throw AppError.notFound('Document not found.');
  try { await fs.access(documentPath(doc.storageKey)); } catch { throw AppError.notFound('The stored file is missing.'); }
  await audit(c, 'DOCUMENT_VIEWED', 'DriverDocument', documentId, { type: doc.type, driverUserId: doc.driverUserId });
  return { doc, stream: openDocument(doc.storageKey) };
}

export async function setVehicleActive(c: Ctx, vehicleId: string, isActive: boolean) {
  const v = await admin.setVehicleActive(vehicleId, isActive);
  if (!v) throw AppError.notFound('Vehicle not found.');
  await audit(c, 'VEHICLE_STATUS_CHANGED', 'Vehicle', vehicleId, { registration: v.registration, isActive });
  return v;
}

// ---- rides ----
export async function cancelRideAsAdmin(c: Ctx, rideId: string, reason: string) {
  const ride = await rides.getRideDetail(rideId);
  if (!ride) throw AppError.notFound('Ride not found.');
  if (!PASSENGER_CANCELLABLE.includes(ride.status)) throw AppError.invalidState('This ride can no longer be cancelled.');
  assertTransition(ride.status, 'CANCELLED');
  const ok = await rides.transitionRide({
    rideId, from: ride.status, to: 'CANCELLED', actorType: 'ADMIN', actorId: c.actor.id, note: reason,
    data: { cancelledAt: new Date(), cancelledBy: 'ADMIN', cancellationReason: reason },
  });
  if (!ok) throw AppError.invalidState('This ride just changed. Refresh and try again.');
  await audit(c, 'RIDE_CANCELLED_BY_ADMIN', 'Ride', rideId, { from: ride.status, reason });
  await publishRideChange(rideId);
  return { id: rideId, status: 'CANCELLED' as const };
}

// ---- categories and pricing ----
export async function updateCategory(c: Ctx, categoryId: string, changes: Parameters<typeof admin.updateCategory>[1]) {
  const before = (await admin.listCategories()).find((x) => x.id === categoryId);
  if (!before) throw AppError.notFound('Category not found.');
  const updated = await admin.updateCategory(categoryId, changes);
  if (!updated) throw AppError.notFound('Category not found.');
  await audit(c, 'CATEGORY_UPDATED', 'RideCategory', categoryId, { code: before.code, ...diff(before, changes) });
  return updated;
}

export async function updatePricing(c: Ctx, input: { categoryCode: string } & Partial<PricingFields>) {
  const { categoryCode, ...changes } = input;
  const before = (await admin.listPricing()).find((p) => p.categoryCode === categoryCode);
  if (!before) throw AppError.notFound('No active pricing for that category.');
  const updated = await admin.updatePricing(before.id, changes);
  if (!updated) throw AppError.notFound('Pricing not found.');
  await audit(c, 'PRICING_UPDATED', 'FareConfiguration', before.id, { categoryCode, ...diff(before, changes) });
  return updated;
}

export async function setTicketStatus(c: Ctx, ticketId: string, status: string) {
  const t = await admin.setTicketStatus(ticketId, status);
  if (!t) throw AppError.notFound('Ticket not found.');
  await audit(c, 'TICKET_STATUS_CHANGED', 'SupportTicket', ticketId, { to: status });
  return t;
}
