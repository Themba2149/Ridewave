import type { AdminRepository } from '../../repositories/admin.repository';
import type { AdminDriverRow, AdminRideRow, AuditRow, CategoryRow, PricingRow, ReviewRow, TicketRow } from '../../types/admin';
import { ACTIVE_STATUSES } from '../../services/ride-state';
import { authWorld } from './fake-auth-repository';
import { world, type DriverState, type StoredRide } from './fake-rides-repository';

/** In-memory stand-in for the Prisma admin repository, reading the same data the other fakes hold. */
export function createFakeAdminRepository() {
  let seq = 0;
  const tickets: TicketRow[] = [];
  const audit: AuditRow[] = [];
  const reviewRows: ReviewRow[] = [];
  const inactiveCategories = new Set<string>();
  const userOf = (userId: string) => authWorld.users.find((u) => u.id === userId);
  const nameOfProfile = (pid: string | null) => (pid ? userOf(world.byProfile(pid)?.userId ?? '')?.fullName ?? world.byProfile(pid)?.name ?? null : null);

  const rideRow = (r: StoredRide): AdminRideRow => ({
    id: r.id, status: r.status, categoryName: r.category.name, passengerName: userOf(r.passengerUserId)?.fullName ?? 'Unknown', driverName: nameOfProfile(r.driverProfileId),
    pickupAddress: r.pickup.address, dropoffAddress: r.dropoff.address, estimatedFareMinor: r.estimatedFareMinor, finalFareMinor: r.finalFareMinor, requestedAt: r.requestedAt,
  });
  const driverRow = (d: DriverState): AdminDriverRow => ({
    id: d.id, userId: d.userId, fullName: userOf(d.userId)?.fullName ?? d.name, email: userOf(d.userId)?.email ?? '', phone: null, approvalStatus: d.approval, approvalNote: d.approvalNote ?? null,
    isOnline: d.isOnline, ratingAverage: 0, ratingCount: 0, vehicleCount: d.vehicles.length, documentCount: world.docs.filter((x) => x.driverId === d.id).length, createdAt: new Date(0),
  });
  const vehicleRows = () => [...world.drivers.values()].flatMap((d) => d.vehicles.map((v) => ({ id: v.id, driverName: d.name, make: v.make, model: v.model, year: v.year, colour: v.colour, registration: v.registration, passengerCapacity: v.passengerCapacity, isActive: v.isActive, categoryName: v.category.name })));
  const pricingRow = (c: (typeof world.categories)[number]): PricingRow => ({ id: `pc_${c.id}`, categoryId: c.id, categoryCode: c.code, categoryName: c.name, ...c.fare, currency: 'ZAR' });
  const categoryRow = (c: (typeof world.categories)[number], i: number): CategoryRow => ({ id: c.id, code: c.code, name: c.name, description: c.description, capacity: c.capacity, luggageNote: c.luggageNote, isActive: !inactiveCategories.has(c.id), sortOrder: i + 1 });
  const slice = <T,>(all: T[], page: number, pageSize: number) => ({ items: all.slice((page - 1) * pageSize, page * pageSize), total: all.length });

  const repo: AdminRepository = {
    async overview() {
      const completed = world.rides.filter((r) => r.status === 'COMPLETED');
      return {
        totalUsers: authWorld.users.length, passengers: authWorld.users.filter((u) => u.role === 'PASSENGER').length, drivers: authWorld.users.filter((u) => u.role === 'DRIVER').length,
        pendingDriverApprovals: [...world.drivers.values()].filter((d) => d.approval === 'PENDING').length,
        activeRides: world.rides.filter((r) => ACTIVE_STATUSES.includes(r.status)).length, completedRides: completed.length, cancelledRides: world.rides.filter((r) => r.status === 'CANCELLED').length,
        revenueMinor: completed.reduce((s, r) => s + (r.finalFareMinor ?? 0), 0),
      };
    },
    async ridesSince(since) { return world.rides.filter((r) => r.requestedAt >= since || (r.completedAt && r.completedAt >= since)).map((r) => ({ requestedAt: r.requestedAt, completedAt: r.completedAt, status: r.status, finalFareMinor: r.finalFareMinor })); },
    async recentRides(limit) { return [...world.rides].sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime()).slice(0, limit).map(rideRow); },
    async listRides({ status, search, page, pageSize }) {
      const rows = world.rides.filter((r) => (!status || r.status === status) && (!search || r.pickup.address.includes(search) || r.dropoff.address.includes(search))).map(rideRow);
      return slice(rows, page, pageSize);
    },
    async topDrivers(limit) {
      const by = new Map<string, { n: number; sum: number }>();
      for (const r of world.rides) if (r.status === 'COMPLETED' && r.driverProfileId) { const x = by.get(r.driverProfileId) ?? { n: 0, sum: 0 }; x.n += 1; x.sum += r.finalFareMinor ?? 0; by.set(r.driverProfileId, x); }
      return [...by.entries()].sort((a, b) => b[1].sum - a[1].sum).slice(0, limit).map(([pid, x]) => ({ driverId: pid, name: nameOfProfile(pid) ?? pid, approvalStatus: world.byProfile(pid)?.approval ?? '', isOnline: !!world.byProfile(pid)?.isOnline, ratingAverage: 0, ratingCount: 0, completedTrips: x.n, grossMinor: x.sum }));
    },

    async listDrivers({ approval, search, page, pageSize }) {
      const rows = [...world.drivers.values()].map(driverRow).filter((d) => (!approval || d.approvalStatus === approval) && (!search || d.fullName.includes(search) || d.email.includes(search)));
      return slice(rows, page, pageSize);
    },
    async getDriver(did) {
      const d = world.byProfile(did);
      if (!d) return null;
      return { ...driverRow(d), vehicles: vehicleRows().filter((v) => d.vehicles.some((x) => x.id === v.id)), documents: world.docs.filter((x) => x.driverId === did).map(({ storageKey: _k, ...rest }) => (void _k, rest)) };
    },
    async setDriverApproval(did, { status, note }) {
      const d = world.byProfile(did);
      if (!d) return null;
      d.approval = status; d.approvalNote = note ?? null;
      if (status !== 'APPROVED') d.isOnline = false;
      return driverRow(d);
    },
    async setDriverOfflineByUser(userId) { const d = world.drivers.get(userId); if (d) d.isOnline = false; },

    async getDocument(did) { const d = world.docs.find((x) => x.id === did); return d ? { ...d, driverUserId: world.byProfile(d.driverId)?.userId ?? '' } : null; },
    async setDocumentReview(did, { status, note }) { const d = world.docs.find((x) => x.id === did); if (!d) return null; d.status = status; d.reviewNote = note ?? null; d.reviewedAt = new Date(); return d; },

    async listVehicles({ search, active, page, pageSize }) {
      return slice(vehicleRows().filter((v) => (active === undefined || v.isActive === active) && (!search || v.registration.includes(search) || v.make.includes(search))), page, pageSize);
    },
    async setVehicleActive(vid, isActive) {
      for (const d of world.drivers.values()) { const v = d.vehicles.find((x) => x.id === vid); if (v) { v.isActive = isActive; return vehicleRows().find((x) => x.id === vid)!; } }
      return null;
    },

    async listCategories() { return world.categories.map(categoryRow); },
    async updateCategory(cid, data) {
      const i = world.categories.findIndex((c) => c.id === cid);
      if (i < 0) return null;
      const c = world.categories[i]!;
      const { isActive, sortOrder: _s, ...rest } = data;
      void _s;
      Object.assign(c, rest);
      if (isActive === true) inactiveCategories.delete(c.id);
      if (isActive === false) inactiveCategories.add(c.id);
      return categoryRow(c, i);
    },
    async listPricing() { return world.categories.map(pricingRow); },
    async updatePricing(pid, data) {
      const c = world.categories.find((x) => `pc_${x.id}` === pid);
      if (!c) return null;
      Object.assign(c.fare, data);
      return pricingRow(c);
    },

    async listTickets({ status, page, pageSize }) { return slice(tickets.filter((t) => !status || t.status === status), page, pageSize); },
    async setTicketStatus(tid, status) { const t = tickets.find((x) => x.id === tid); if (!t) return null; t.status = status; return t; },
    async listReviews({ rating, page, pageSize }) { return slice(reviewRows.filter((r) => !rating || r.rating === rating), page, pageSize); },

    async recordAudit(e) { audit.unshift({ id: `a_${++seq}`, actorEmail: userOf(e.actorId ?? '')?.email ?? null, action: e.action, entityType: e.entityType, entityId: e.entityId ?? null, metadata: e.metadata ?? null, createdAt: new Date() }); },
    async listAudit({ action, page, pageSize }) { return slice(audit.filter((a) => !action || a.action.includes(action)), page, pageSize); },
  };
  const reset = () => { tickets.length = 0; audit.length = 0; reviewRows.length = 0; inactiveCategories.clear(); };
  return { repo, tickets, audit, reviewRows, reset };
}
export const adminWorld = createFakeAdminRepository();
