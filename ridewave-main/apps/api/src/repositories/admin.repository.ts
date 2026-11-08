import type { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { ACTIVE_STATUSES } from '../services/ride-state';
import type {
  AdminDriverDetail, AdminDriverRow, AdminRideRow, AdminVehicleRow, AuditEntry, AuditRow, CategoryRow, DocumentRow, DriverPerfRow, Overview, Page, PricingFields, PricingRow,
  ReviewRow, RideStamp, TicketRow,
} from '../types/admin';
import type { RideStatus } from '../types/ride';

export interface AdminRepository {
  overview(): Promise<Overview>;
  ridesSince(since: Date): Promise<RideStamp[]>;
  recentRides(limit: number): Promise<AdminRideRow[]>;
  listRides(q: { status?: RideStatus; search?: string; page: number; pageSize: number }): Promise<Page<AdminRideRow>>;
  topDrivers(limit: number): Promise<DriverPerfRow[]>;
  listDrivers(q: { approval?: string; search?: string; page: number; pageSize: number }): Promise<Page<AdminDriverRow>>;
  getDriver(id: string): Promise<AdminDriverDetail | null>;
  setDriverApproval(id: string, data: { status: string; note?: string }): Promise<AdminDriverRow | null>;
  setDriverOfflineByUser(userId: string): Promise<void>;
  getDocument(id: string): Promise<(DocumentRow & { driverUserId: string }) | null>;
  setDocumentReview(id: string, data: { status: string; note?: string }): Promise<DocumentRow | null>;
  listVehicles(q: { search?: string; active?: boolean; page: number; pageSize: number }): Promise<Page<AdminVehicleRow>>;
  setVehicleActive(id: string, isActive: boolean): Promise<AdminVehicleRow | null>;
  listCategories(): Promise<CategoryRow[]>;
  updateCategory(id: string, data: Partial<Pick<CategoryRow, 'name' | 'description' | 'capacity' | 'isActive' | 'sortOrder'>>): Promise<CategoryRow | null>;
  listPricing(): Promise<PricingRow[]>;
  updatePricing(configId: string, data: Partial<PricingFields>): Promise<PricingRow | null>;
  listTickets(q: { status?: string; page: number; pageSize: number }): Promise<Page<TicketRow>>;
  setTicketStatus(id: string, status: string): Promise<TicketRow | null>;
  listReviews(q: { rating?: number; page: number; pageSize: number }): Promise<Page<ReviewRow>>;
  recordAudit(entry: AuditEntry): Promise<void>;
  listAudit(q: { action?: string; page: number; pageSize: number }): Promise<Page<AuditRow>>;
}

const skipTake = (q: { page: number; pageSize: number }) => ({ skip: (q.page - 1) * q.pageSize, take: q.pageSize });
const rideRow = (r: { id: string; status: RideStatus; pickupAddress: string; dropoffAddress: string; estimatedFareMinor: number; finalFareMinor: number | null; requestedAt: Date;
  category: { name: string }; passenger: { user: { fullName: string } }; driver: { user: { fullName: string } } | null }): AdminRideRow => ({
  id: r.id, status: r.status, categoryName: r.category.name, passengerName: r.passenger.user.fullName, driverName: r.driver?.user.fullName ?? null,
  pickupAddress: r.pickupAddress, dropoffAddress: r.dropoffAddress, estimatedFareMinor: r.estimatedFareMinor, finalFareMinor: r.finalFareMinor, requestedAt: r.requestedAt,
});
const rideInclude = { category: { select: { name: true } }, passenger: { select: { user: { select: { fullName: true } } } }, driver: { select: { user: { select: { fullName: true } } } } } as const;

const driverInclude = { user: { select: { fullName: true, email: true, phone: true } }, _count: { select: { vehicles: true, documents: true } } } as const;
const driverRow = (d: { id: string; userId: string; approvalStatus: string; approvalNote: string | null; isOnline: boolean; ratingAverage: number; ratingCount: number; createdAt: Date;
  user: { fullName: string; email: string; phone: string | null }; _count: { vehicles: number; documents: number } }): AdminDriverRow => ({
  id: d.id, userId: d.userId, fullName: d.user.fullName, email: d.user.email, phone: d.user.phone, approvalStatus: d.approvalStatus, approvalNote: d.approvalNote,
  isOnline: d.isOnline, ratingAverage: d.ratingAverage, ratingCount: d.ratingCount, vehicleCount: d._count.vehicles, documentCount: d._count.documents, createdAt: d.createdAt,
});
const vehicleSelect = { id: true, make: true, model: true, year: true, colour: true, registration: true, passengerCapacity: true, isActive: true, category: { select: { name: true } }, driver: { select: { user: { select: { fullName: true } } } } } as const;
const vehicleRow = (v: { id: string; make: string; model: string; year: number; colour: string; registration: string; passengerCapacity: number; isActive: boolean; category: { name: string }; driver: { user: { fullName: string } } }): AdminVehicleRow => ({
  id: v.id, driverName: v.driver.user.fullName, make: v.make, model: v.model, year: v.year, colour: v.colour, registration: v.registration, passengerCapacity: v.passengerCapacity, isActive: v.isActive, categoryName: v.category.name,
});
const pricingInclude = { category: { select: { code: true, name: true } } } as const;
const pricingRow = (f: { id: string; categoryId: string; currency: string; baseFareMinor: number; perKmMinor: number; perMinuteMinor: number; minimumFareMinor: number; bookingFeeMinor: number; cancellationFeeMinor: number; freeCancelWindowSeconds: number; demandMultiplierBp: number; roundingMinor: number; category: { code: string; name: string } }): PricingRow => ({
  id: f.id, categoryId: f.categoryId, categoryCode: f.category.code, categoryName: f.category.name, currency: f.currency, baseFareMinor: f.baseFareMinor, perKmMinor: f.perKmMinor, perMinuteMinor: f.perMinuteMinor,
  minimumFareMinor: f.minimumFareMinor, bookingFeeMinor: f.bookingFeeMinor, cancellationFeeMinor: f.cancellationFeeMinor, freeCancelWindowSeconds: f.freeCancelWindowSeconds, demandMultiplierBp: f.demandMultiplierBp, roundingMinor: f.roundingMinor,
});
const notFound = (e: unknown) => typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2025';

export const adminRepository: AdminRepository = {
  async overview() {
    const [totalUsers, passengers, drivers, pendingDriverApprovals, activeRides, completedRides, cancelledRides, revenue] = await Promise.all([
      prisma.user.count(), prisma.user.count({ where: { role: 'PASSENGER' } }), prisma.user.count({ where: { role: 'DRIVER' } }),
      prisma.driverProfile.count({ where: { approvalStatus: 'PENDING' } }),
      prisma.ride.count({ where: { status: { in: [...ACTIVE_STATUSES] } } }), prisma.ride.count({ where: { status: 'COMPLETED' } }), prisma.ride.count({ where: { status: 'CANCELLED' } }),
      prisma.ride.aggregate({ where: { status: 'COMPLETED' }, _sum: { finalFareMinor: true } }),
    ]);
    return { totalUsers, passengers, drivers, pendingDriverApprovals, activeRides, completedRides, cancelledRides, revenueMinor: revenue._sum.finalFareMinor ?? 0 };
  },
  ridesSince: (since) => prisma.ride.findMany({ where: { OR: [{ requestedAt: { gte: since } }, { completedAt: { gte: since } }] }, select: { requestedAt: true, completedAt: true, status: true, finalFareMinor: true } }),
  async recentRides(limit) {
    return (await prisma.ride.findMany({ orderBy: { requestedAt: 'desc' }, take: limit, include: rideInclude })).map(rideRow);
  },
  async listRides({ status, search, page, pageSize }) {
    const where: Prisma.RideWhereInput = {
      ...(status ? { status } : {}),
      ...(search ? { OR: [{ pickupAddress: { contains: search } }, { dropoffAddress: { contains: search } }, { passenger: { user: { fullName: { contains: search } } } }, { driver: { user: { fullName: { contains: search } } } }] } : {}),
    };
    const [rows, total] = await Promise.all([prisma.ride.findMany({ where, orderBy: { requestedAt: 'desc' }, ...skipTake({ page, pageSize }), include: rideInclude }), prisma.ride.count({ where })]);
    return { items: rows.map(rideRow), total };
  },
  async topDrivers(limit) {
    const groups = await prisma.ride.groupBy({ by: ['driverId'], where: { status: 'COMPLETED', driverId: { not: null } }, _count: { _all: true }, _sum: { finalFareMinor: true }, orderBy: { _sum: { finalFareMinor: 'desc' } }, take: limit });
    const ids = groups.flatMap((g) => (g.driverId ? [g.driverId] : []));
    const profiles = await prisma.driverProfile.findMany({ where: { id: { in: ids } }, include: { user: { select: { fullName: true } } } });
    return groups.flatMap((g) => {
      const p = profiles.find((x) => x.id === g.driverId);
      return p ? [{ driverId: p.id, name: p.user.fullName, approvalStatus: p.approvalStatus, isOnline: p.isOnline, ratingAverage: p.ratingAverage, ratingCount: p.ratingCount, completedTrips: g._count._all, grossMinor: g._sum.finalFareMinor ?? 0 }] : [];
    });
  },

  async listDrivers({ approval, search, page, pageSize }) {
    const where: Prisma.DriverProfileWhereInput = {
      ...(approval ? { approvalStatus: approval as never } : {}),
      ...(search ? { user: { OR: [{ fullName: { contains: search } }, { email: { contains: search } }] } } : {}),
    };
    const [rows, total] = await Promise.all([prisma.driverProfile.findMany({ where, orderBy: { createdAt: 'desc' }, ...skipTake({ page, pageSize }), include: driverInclude }), prisma.driverProfile.count({ where })]);
    return { items: rows.map(driverRow), total };
  },
  async getDriver(id) {
    const d = await prisma.driverProfile.findUnique({
      where: { id },
      include: { ...driverInclude, vehicles: { select: vehicleSelect }, documents: { orderBy: { createdAt: 'desc' }, select: { id: true, driverId: true, type: true, status: true, originalName: true, mimeType: true, sizeBytes: true, reviewNote: true, createdAt: true, reviewedAt: true } } },
    });
    return d ? { ...driverRow(d), vehicles: d.vehicles.map(vehicleRow), documents: d.documents } : null;
  },
  async setDriverApproval(id, { status, note }) {
    try {
      const d = await prisma.driverProfile.update({
        where: { id },
        data: { approvalStatus: status as never, approvalNote: note ?? null, approvedAt: status === 'APPROVED' ? new Date() : null, ...(status === 'APPROVED' ? {} : { isOnline: false }) },
        include: driverInclude,
      });
      return driverRow(d);
    } catch (e) { if (notFound(e)) return null; throw e; }
  },
  async setDriverOfflineByUser(userId) { await prisma.driverProfile.updateMany({ where: { userId }, data: { isOnline: false } }); },

  async getDocument(id) {
    const d = await prisma.driverDocument.findUnique({ where: { id }, include: { driver: { select: { userId: true } } } });
    if (!d) return null;
    const { driver, ...rest } = d;
    return { ...rest, driverUserId: driver.userId };
  },
  async setDocumentReview(id, { status, note }) {
    try { return await prisma.driverDocument.update({ where: { id }, data: { status: status as never, reviewNote: note ?? null, reviewedAt: new Date() } }); } catch (e) { if (notFound(e)) return null; throw e; }
  },

  async listVehicles({ search, active, page, pageSize }) {
    const where: Prisma.VehicleWhereInput = {
      ...(active !== undefined ? { isActive: active } : {}),
      ...(search ? { OR: [{ registration: { contains: search } }, { make: { contains: search } }, { model: { contains: search } }, { driver: { user: { fullName: { contains: search } } } }] } : {}),
    };
    const [rows, total] = await Promise.all([prisma.vehicle.findMany({ where, orderBy: { createdAt: 'desc' }, ...skipTake({ page, pageSize }), select: vehicleSelect }), prisma.vehicle.count({ where })]);
    return { items: rows.map(vehicleRow), total };
  },
  async setVehicleActive(id, isActive) {
    try { return vehicleRow(await prisma.vehicle.update({ where: { id }, data: { isActive }, select: vehicleSelect })); } catch (e) { if (notFound(e)) return null; throw e; }
  },

  listCategories: () => prisma.rideCategory.findMany({ orderBy: { sortOrder: 'asc' }, select: { id: true, code: true, name: true, description: true, capacity: true, luggageNote: true, isActive: true, sortOrder: true } }),
  async updateCategory(id, data) {
    try { return await prisma.rideCategory.update({ where: { id }, data, select: { id: true, code: true, name: true, description: true, capacity: true, luggageNote: true, isActive: true, sortOrder: true } }); } catch (e) { if (notFound(e)) return null; throw e; }
  },
  async listPricing() {
    const rows = await prisma.fareConfiguration.findMany({ where: { isActive: true, cityCode: 'JNB' }, include: pricingInclude, orderBy: { category: { sortOrder: 'asc' } } });
    return rows.map(pricingRow);
  },
  async updatePricing(configId, data) {
    try { return pricingRow(await prisma.fareConfiguration.update({ where: { id: configId }, data, include: pricingInclude })); } catch (e) { if (notFound(e)) return null; throw e; }
  },

  async listTickets({ status, page, pageSize }) {
    const where: Prisma.SupportTicketWhereInput = status ? { status: status as never } : {};
    const [items, total] = await Promise.all([prisma.supportTicket.findMany({ where, orderBy: { createdAt: 'desc' }, ...skipTake({ page, pageSize }), select: { id: true, name: true, email: true, subject: true, message: true, status: true, createdAt: true } }), prisma.supportTicket.count({ where })]);
    return { items, total };
  },
  async setTicketStatus(id, status) {
    try { return await prisma.supportTicket.update({ where: { id }, data: { status: status as never }, select: { id: true, name: true, email: true, subject: true, message: true, status: true, createdAt: true } }); } catch (e) { if (notFound(e)) return null; throw e; }
  },
  async listReviews({ rating, page, pageSize }) {
    const where: Prisma.ReviewWhereInput = rating ? { rating } : {};
    const [rows, total] = await Promise.all([
      prisma.review.findMany({ where, orderBy: { createdAt: 'desc' }, ...skipTake({ page, pageSize }), include: { author: { select: { fullName: true } }, subject: { select: { fullName: true } } } }),
      prisma.review.count({ where }),
    ]);
    return { items: rows.map((r) => ({ id: r.id, rideId: r.rideId, rating: r.rating, comment: r.comment, authorName: r.author.fullName, subjectName: r.subject.fullName, createdAt: r.createdAt })), total };
  },

  async recordAudit(e) {
    await prisma.auditLog.create({ data: { actorId: e.actorId, action: e.action, entityType: e.entityType, entityId: e.entityId ?? null, metadata: (e.metadata ?? undefined) as Prisma.InputJsonValue | undefined, ipAddress: e.ipAddress ?? null } });
  },
  async listAudit({ action, page, pageSize }) {
    const where: Prisma.AuditLogWhereInput = action ? { action: { contains: action } } : {};
    const [rows, total] = await Promise.all([prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, ...skipTake({ page, pageSize }), include: { actor: { select: { email: true } } } }), prisma.auditLog.count({ where })]);
    return { items: rows.map((r) => ({ id: r.id, actorEmail: r.actor?.email ?? null, action: r.action, entityType: r.entityType, entityId: r.entityId, metadata: r.metadata, createdAt: r.createdAt })), total };
  },
};
