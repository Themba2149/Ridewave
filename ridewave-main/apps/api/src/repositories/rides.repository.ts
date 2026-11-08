import { prisma } from '../config/database';
import type { ActorType, Candidate, CategoryWithFare, FareBreakdown, MatchingInfo, Place, RideDetail, RideStatus, RideSummary } from '../types/ride';
import { AppError } from '../utils/errors';
import { ACTIVE_STATUSES } from '../services/ride-state';

export type NewRide = {
  passengerProfileId: string; passengerUserId: string; categoryId: string; idempotencyKey: string;
  pickup: Place; dropoff: Place; currency: string; distanceMeters: number; durationSeconds: number;
  estimatedFareMinor: number; fareBreakdown: FareBreakdown; routeSource: string;
};
export type SavedLocationRow = { id: string; label: string; address: string; lat: number; lng: number; isFavorite: boolean; createdAt: Date };

export interface RidesRepository {
  listCategoriesWithFare(): Promise<CategoryWithFare[]>;
  findCategoryWithFare(code: string): Promise<CategoryWithFare | null>;
  getPassengerProfileId(userId: string): Promise<string | null>;
  findRideByIdempotencyKey(passengerProfileId: string, key: string): Promise<{ id: string } | null>;
  findActiveRideId(passengerProfileId: string): Promise<string | null>;
  createRide(input: NewRide): Promise<{ id: string }>;
  getRideDetail(id: string): Promise<RideDetail | null>;
  listPassengerRides(passengerProfileId: string, q: { scope: 'active' | 'past' | 'all'; page: number; pageSize: number }): Promise<{ items: RideSummary[]; total: number }>;
  /** Atomic compare-and-set: only changes the ride if it is still in `from`. Returns false if someone else changed it first. */
  transitionRide(input: {
    rideId: string; from: RideStatus; to: RideStatus; actorType: ActorType; actorId?: string; note?: string;
    /** Extra precondition: only change the ride if it is still assigned to this driver profile. */
    requireDriverId?: string;
    data?: Partial<{
      cancelledAt: Date; cancelledBy: ActorType; cancellationReason: string; finalFareMinor: number; fareBreakdown: RideDetail['fareBreakdown'];
      driverId: string | null; vehicleId: string | null; assignedAt: Date | null; arrivedAt: Date; startedAt: Date; completedAt: Date; declinedBy: string;
    }>;
  }): Promise<boolean>;
  getMatchingInfo(rideId: string): Promise<MatchingInfo | null>;
  findCandidateDrivers(categoryId: string, excludeDriverProfileIds: string[]): Promise<Candidate[]>;
  /** Atomically assigns the driver to the ride, but only if the ride is still searching and the driver has no other active ride. */
  claimDriver(input: { rideId: string; driverProfileId: string; vehicleId: string; assignedAt: Date }): Promise<boolean>;
  listSearchingRideIds(limit: number): Promise<string[]>;
  createReview(input: { rideId: string; authorUserId: string; subjectUserId: string; rating: number; comment?: string }): Promise<void>;
  listSavedLocations(passengerProfileId: string): Promise<SavedLocationRow[]>;
  countSavedLocations(passengerProfileId: string): Promise<number>;
  createSavedLocation(passengerProfileId: string, data: { label: string; address: string; lat: number; lng: number; isFavorite: boolean }): Promise<SavedLocationRow>;
  deleteSavedLocation(passengerProfileId: string, id: string): Promise<boolean>;
}

const fareArgs = { where: { isActive: true, cityCode: 'JNB' }, take: 1 } as const;
function toCategory(c: {
  id: string; code: string; name: string; description: string; capacity: number; luggageNote: string | null;
  fareConfigurations: Array<{ currency: string; baseFareMinor: number; perKmMinor: number; perMinuteMinor: number; minimumFareMinor: number; bookingFeeMinor: number; demandMultiplierBp: number; roundingMinor: number; cancellationFeeMinor: number; freeCancelWindowSeconds: number }>;
}): CategoryWithFare | null {
  const f = c.fareConfigurations[0];
  if (!f) return null;
  const { id, code, name, description, capacity, luggageNote } = c;
  return { id, code, name, description, capacity, luggageNote, fare: { ...f } };
}

const isUniqueViolation = (e: unknown) => typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2002';

export const ridesRepository: RidesRepository = {
  async listCategoriesWithFare() {
    const rows = await prisma.rideCategory.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' }, include: { fareConfigurations: fareArgs } });
    return rows.flatMap((r) => { const c = toCategory(r); return c ? [c] : []; });
  },
  async findCategoryWithFare(code) {
    const row = await prisma.rideCategory.findFirst({ where: { code, isActive: true }, include: { fareConfigurations: fareArgs } });
    return row ? toCategory(row) : null;
  },
  async getPassengerProfileId(userId) {
    return (await prisma.passengerProfile.findUnique({ where: { userId }, select: { id: true } }))?.id ?? null;
  },
  findRideByIdempotencyKey: (passengerProfileId, key) =>
    prisma.ride.findFirst({ where: { passengerId: passengerProfileId, idempotencyKey: key }, select: { id: true } }),
  async findActiveRideId(passengerProfileId) {
    return (await prisma.ride.findFirst({ where: { passengerId: passengerProfileId, status: { in: [...ACTIVE_STATUSES] } }, select: { id: true } }))?.id ?? null;
  },

  async createRide(i) {
    try {
      return await prisma.ride.create({
        data: {
          passengerId: i.passengerProfileId, categoryId: i.categoryId, idempotencyKey: i.idempotencyKey, status: 'SEARCHING_FOR_DRIVER',
          pickupAddress: i.pickup.address, pickupLat: i.pickup.lat, pickupLng: i.pickup.lng,
          dropoffAddress: i.dropoff.address, dropoffLat: i.dropoff.lat, dropoffLng: i.dropoff.lng,
          currency: i.currency, distanceMeters: i.distanceMeters, durationSeconds: i.durationSeconds,
          estimatedFareMinor: i.estimatedFareMinor, fareBreakdown: i.fareBreakdown, routeSource: i.routeSource,
          statusHistory: { create: [
            { fromStatus: null, toStatus: 'REQUESTED', actorType: 'PASSENGER', actorId: i.passengerUserId },
            { fromStatus: 'REQUESTED', toStatus: 'SEARCHING_FOR_DRIVER', actorType: 'SYSTEM', note: 'Looking for an available driver' },
          ] },
        },
        select: { id: true },
      });
    } catch (e) {
      if (isUniqueViolation(e)) throw AppError.conflict('This booking was already submitted.');
      throw e;
    }
  },

  async getRideDetail(id) {
    const r = await prisma.ride.findUnique({
      where: { id },
      include: {
        category: { select: { code: true, name: true, fareConfigurations: fareArgs } },
        passenger: { select: { userId: true, user: { select: { fullName: true } } } },
        driver: { include: { user: { select: { id: true, fullName: true } } } },
        vehicle: true,
        statusHistory: { orderBy: { createdAt: 'asc' } },
        reviews: { select: { authorId: true } },
      },
    });
    if (!r) return null;
    const fare = r.category.fareConfigurations[0];
    return {
      id: r.id, status: r.status, passengerUserId: r.passenger.userId, driverUserId: r.driver?.user.id ?? null,
      passengerFirstName: r.passenger.user.fullName.split(' ')[0] ?? 'Passenger',
      driverLocation: r.driver && r.driver.currentLat !== null && r.driver.currentLng !== null ? { lat: r.driver.currentLat, lng: r.driver.currentLng } : null,
      category: { code: r.category.code, name: r.category.name },
      pickup: { address: r.pickupAddress, lat: r.pickupLat, lng: r.pickupLng },
      dropoff: { address: r.dropoffAddress, lat: r.dropoffLat, lng: r.dropoffLng },
      currency: r.currency, distanceMeters: r.distanceMeters, durationSeconds: r.durationSeconds,
      estimatedFareMinor: r.estimatedFareMinor, finalFareMinor: r.finalFareMinor,
      fareBreakdown: r.fareBreakdown as RideDetail['fareBreakdown'], routeSource: r.routeSource,
      requestedAt: r.requestedAt, assignedAt: r.assignedAt, arrivedAt: r.arrivedAt, startedAt: r.startedAt, completedAt: r.completedAt, cancelledAt: r.cancelledAt,
      cancellationReason: r.cancellationReason, cancelledBy: r.cancelledBy,
      statusHistory: r.statusHistory.map((h) => ({ fromStatus: h.fromStatus, toStatus: h.toStatus, actorType: h.actorType, note: h.note, createdAt: h.createdAt })),
      driver: r.driver && {
        fullName: r.driver.user.fullName, ratingAverage: r.driver.ratingAverage, ratingCount: r.driver.ratingCount,
        vehicle: r.vehicle && { make: r.vehicle.make, model: r.vehicle.model, colour: r.vehicle.colour, registration: r.vehicle.registration },
      },
      hasReview: r.reviews.length > 0,
      cancellationPolicy: { feeMinor: fare?.cancellationFeeMinor ?? 0, freeWindowSeconds: fare?.freeCancelWindowSeconds ?? 0 },
    };
  },

  async listPassengerRides(passengerProfileId, { scope, page, pageSize }) {
    const statusFilter = scope === 'active' ? { status: { in: [...ACTIVE_STATUSES] } } : scope === 'past' ? { status: { notIn: [...ACTIVE_STATUSES] } } : {};
    const where = { passengerId: passengerProfileId, ...statusFilter };
    const [rows, total] = await Promise.all([
      prisma.ride.findMany({ where, orderBy: { requestedAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize, include: { category: { select: { name: true } } } }),
      prisma.ride.count({ where }),
    ]);
    return {
      total,
      items: rows.map((r) => ({
        id: r.id, status: r.status, categoryName: r.category.name, pickupAddress: r.pickupAddress, dropoffAddress: r.dropoffAddress,
        currency: r.currency, estimatedFareMinor: r.estimatedFareMinor, finalFareMinor: r.finalFareMinor, requestedAt: r.requestedAt,
      })),
    };
  },

  async transitionRide({ rideId, from, to, actorType, actorId, note, data, requireDriverId }) {
    return prisma.$transaction(async (tx) => {
      const { fareBreakdown, ...rest } = data ?? {};
      const res = await tx.ride.updateMany({
        where: { id: rideId, status: from, ...(requireDriverId ? { driverId: requireDriverId } : {}) },
        data: { status: to, ...rest, ...(fareBreakdown ? { fareBreakdown } : {}) },
      });
      if (res.count === 0) return false;
      await tx.rideStatusHistory.create({ data: { rideId, fromStatus: from, toStatus: to, actorType, actorId, note } });
      return true;
    });
  },

  async getMatchingInfo(rideId) {
    const r = await prisma.ride.findUnique({
      where: { id: rideId },
      select: {
        id: true, status: true, categoryId: true, pickupLat: true, pickupLng: true, declinedBy: true, assignedAt: true, driverId: true, requestedAt: true,
        statusHistory: { where: { toStatus: 'SEARCHING_FOR_DRIVER' }, orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
      },
    });
    if (!r) return null;
    return {
      id: r.id, status: r.status, categoryId: r.categoryId, pickup: { lat: r.pickupLat, lng: r.pickupLng },
      declinedBy: r.declinedBy ? r.declinedBy.split(',').filter(Boolean) : [], assignedAt: r.assignedAt, driverProfileId: r.driverId,
      searchStartedAt: r.statusHistory[0]?.createdAt ?? r.requestedAt,
    };
  },

  async findCandidateDrivers(categoryId, excludeDriverProfileIds) {
    const rows = await prisma.driverProfile.findMany({
      where: {
        approvalStatus: 'APPROVED', isOnline: true, currentLat: { not: null }, currentLng: { not: null }, user: { status: 'ACTIVE' },
        id: { notIn: excludeDriverProfileIds },
        vehicles: { some: { categoryId, isActive: true } },
        rides: { none: { status: { in: [...ACTIVE_STATUSES] } } },
      },
      select: { id: true, currentLat: true, currentLng: true, vehicles: { where: { categoryId, isActive: true }, orderBy: { createdAt: 'asc' }, take: 1, select: { id: true } } },
    });
    return rows.flatMap((d) => {
      const vehicle = d.vehicles[0];
      return vehicle && d.currentLat !== null && d.currentLng !== null ? [{ driverProfileId: d.id, vehicleId: vehicle.id, lat: d.currentLat, lng: d.currentLng }] : [];
    });
  },

  async claimDriver({ rideId, driverProfileId, vehicleId, assignedAt }) {
    return prisma.$transaction(async (tx) => {
      // One SQL statement does the check and the write together, so two requests cannot both claim the same driver.
      // (Verified on SQLite. On PostgreSQL use SERIALIZABLE isolation or a partial unique index; see docs.)
      const changed = await tx.$executeRaw`UPDATE "Ride" SET "driverId" = ${driverProfileId}, "vehicleId" = ${vehicleId}, "status" = 'DRIVER_ASSIGNED'
        WHERE "id" = ${rideId} AND "status" = 'SEARCHING_FOR_DRIVER'
        AND NOT EXISTS (SELECT 1 FROM "Ride" r2 WHERE r2."driverId" = ${driverProfileId} AND r2."status" IN ('DRIVER_ASSIGNED','DRIVER_ARRIVING','DRIVER_ARRIVED','IN_PROGRESS'))`;
      if (changed === 0) return false;
      await tx.ride.update({ where: { id: rideId }, data: { assignedAt } });
      await tx.rideStatusHistory.create({ data: { rideId, fromStatus: 'SEARCHING_FOR_DRIVER', toStatus: 'DRIVER_ASSIGNED', actorType: 'SYSTEM', note: 'Offered to the nearest eligible driver' } });
      return true;
    });
  },

  async listSearchingRideIds(limit) {
    const rows = await prisma.ride.findMany({ where: { status: 'SEARCHING_FOR_DRIVER' }, orderBy: { requestedAt: 'asc' }, take: limit, select: { id: true } });
    return rows.map((r) => r.id);
  },

  async createReview({ rideId, authorUserId, subjectUserId, rating, comment }) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.review.create({ data: { rideId, authorId: authorUserId, subjectId: subjectUserId, rating, comment } });
        const driver = await tx.driverProfile.findUnique({ where: { userId: subjectUserId } });
        if (driver) {
          const count = driver.ratingCount + 1;
          const average = Math.round(((driver.ratingAverage * driver.ratingCount + rating) / count) * 100) / 100;
          await tx.driverProfile.update({ where: { id: driver.id }, data: { ratingCount: count, ratingAverage: average } });
        }
      });
    } catch (e) {
      if (isUniqueViolation(e)) throw AppError.conflict('You have already reviewed this ride.');
      throw e;
    }
  },

  listSavedLocations: (pid) =>
    prisma.savedLocation.findMany({ where: { passengerId: pid }, orderBy: [{ isFavorite: 'desc' }, { createdAt: 'desc' }], select: { id: true, label: true, address: true, lat: true, lng: true, isFavorite: true, createdAt: true } }),
  countSavedLocations: (pid) => prisma.savedLocation.count({ where: { passengerId: pid } }),
  createSavedLocation: (pid, data) =>
    prisma.savedLocation.create({ data: { passengerId: pid, ...data }, select: { id: true, label: true, address: true, lat: true, lng: true, isFavorite: true, createdAt: true } }),
  async deleteSavedLocation(pid, id) {
    return (await prisma.savedLocation.deleteMany({ where: { id, passengerId: pid } })).count > 0; // scoped to the owner
  },
};
