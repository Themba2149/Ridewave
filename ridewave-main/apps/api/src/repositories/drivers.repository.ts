import { prisma } from '../config/database';
import { ACTIVE_STATUSES } from '../services/ride-state';
import type { RideStatus } from '../types/ride';
import type { DocumentRow } from '../types/admin';
import { AppError } from '../utils/errors';

export type DriverContext = { id: string; userId: string; approvalStatus: string; isOnline: boolean; lat: number | null; lng: number | null; activeVehicleCount: number };
export type VehicleRow = { id: string; make: string; model: string; year: number; colour: string; registration: string; passengerCapacity: number; isActive: boolean; category: { code: string; name: string } };
export type DriverRideSummary = {
  id: string; status: RideStatus; categoryName: string; pickupAddress: string; dropoffAddress: string; currency: string;
  estimatedFareMinor: number; finalFareMinor: number | null; requestedAt: Date; completedAt: Date | null; payment: { method: string; status: string } | null;
};

export interface DriversRepository {
  getContext(userId: string): Promise<DriverContext | null>;
  setAvailability(profileId: string, data: { isOnline: boolean; lat?: number; lng?: number }): Promise<void>;
  hasActiveRide(profileId: string): Promise<boolean>;
  listVehicles(profileId: string): Promise<VehicleRow[]>;
  createVehicle(profileId: string, data: { categoryId: string; make: string; model: string; year: number; colour: string; registration: string; passengerCapacity: number }): Promise<VehicleRow>;
  listRides(profileId: string, q: { scope: 'active' | 'past' | 'all'; page: number; pageSize: number }): Promise<{ items: DriverRideSummary[]; total: number }>;
  findCurrentOfferRideId(profileId: string): Promise<string | null>;
  listCompletedSince(profileId: string, since: Date): Promise<Array<{ completedAt: Date; finalFareMinor: number }>>;
  countResponses(userId: string): Promise<{ accepted: number; declined: number }>;
  countCompleted(profileId: string): Promise<number>;
  listDocuments(profileId: string): Promise<DocumentRow[]>;
  countDocuments(profileId: string): Promise<number>;
  createDocument(profileId: string, data: { type: string; originalName: string; storageKey: string; mimeType: string; sizeBytes: number }): Promise<DocumentRow>;
  getOwnDocument(profileId: string, id: string): Promise<DocumentRow | null>;
}

const vehicleSelect = { id: true, make: true, model: true, year: true, colour: true, registration: true, passengerCapacity: true, isActive: true, category: { select: { code: true, name: true } } } as const;

export const driversRepository: DriversRepository = {
  async getContext(userId) {
    const d = await prisma.driverProfile.findUnique({ where: { userId }, include: { _count: { select: { vehicles: { where: { isActive: true } } } } } });
    if (!d) return null;
    return { id: d.id, userId: d.userId, approvalStatus: d.approvalStatus, isOnline: d.isOnline, lat: d.currentLat, lng: d.currentLng, activeVehicleCount: d._count.vehicles };
  },
  async setAvailability(profileId, { isOnline, lat, lng }) {
    await prisma.driverProfile.update({
      where: { id: profileId },
      data: { isOnline, ...(lat !== undefined && lng !== undefined ? { currentLat: lat, currentLng: lng, locationUpdatedAt: new Date() } : {}) },
    });
  },
  async hasActiveRide(profileId) {
    return (await prisma.ride.count({ where: { driverId: profileId, status: { in: [...ACTIVE_STATUSES] } } })) > 0;
  },
  listVehicles: (profileId) => prisma.vehicle.findMany({ where: { driverId: profileId }, orderBy: { createdAt: 'asc' }, select: vehicleSelect }),
  async createVehicle(profileId, data) {
    try {
      return await prisma.vehicle.create({ data: { driverId: profileId, ...data }, select: vehicleSelect });
    } catch (e) {
      if (typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2002') throw AppError.conflict('A vehicle with that registration is already registered.');
      throw e;
    }
  },
  async listRides(profileId, { scope, page, pageSize }) {
    const statusFilter = scope === 'active' ? { status: { in: [...ACTIVE_STATUSES] } } : scope === 'past' ? { status: { notIn: [...ACTIVE_STATUSES] } } : {};
    const where = { driverId: profileId, ...statusFilter };
    const [rows, total] = await Promise.all([
      prisma.ride.findMany({ where, orderBy: { requestedAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize, include: { category: { select: { name: true } }, payments: { orderBy: { createdAt: 'desc' }, take: 1, select: { method: true, status: true } } } }),
      prisma.ride.count({ where }),
    ]);
    return {
      total,
      items: rows.map((r) => ({
        id: r.id, status: r.status, categoryName: r.category.name, pickupAddress: r.pickupAddress, dropoffAddress: r.dropoffAddress, currency: r.currency,
        estimatedFareMinor: r.estimatedFareMinor, finalFareMinor: r.finalFareMinor, requestedAt: r.requestedAt, completedAt: r.completedAt, payment: r.payments[0] ?? null,
      })),
    };
  },
  async findCurrentOfferRideId(profileId) {
    return (await prisma.ride.findFirst({ where: { driverId: profileId, status: 'DRIVER_ASSIGNED' }, select: { id: true } }))?.id ?? null;
  },
  async listCompletedSince(profileId, since) {
    const rows = await prisma.ride.findMany({ where: { driverId: profileId, status: 'COMPLETED', completedAt: { gte: since } }, select: { completedAt: true, finalFareMinor: true } });
    return rows.flatMap((r) => (r.completedAt && r.finalFareMinor !== null ? [{ completedAt: r.completedAt, finalFareMinor: r.finalFareMinor }] : []));
  },
  async countResponses(userId) {
    const [accepted, declined] = await Promise.all([
      prisma.rideStatusHistory.count({ where: { actorId: userId, toStatus: 'DRIVER_ARRIVING' } }),
      prisma.rideStatusHistory.count({ where: { actorId: userId, fromStatus: 'DRIVER_ASSIGNED', toStatus: 'SEARCHING_FOR_DRIVER' } }),
    ]);
    return { accepted, declined };
  },
  countCompleted: (profileId) => prisma.ride.count({ where: { driverId: profileId, status: 'COMPLETED' } }),
  listDocuments: (profileId) => prisma.driverDocument.findMany({ where: { driverId: profileId }, orderBy: { createdAt: 'desc' } }),
  countDocuments: (profileId) => prisma.driverDocument.count({ where: { driverId: profileId } }),
  createDocument: (profileId, data) => prisma.driverDocument.create({ data: { driverId: profileId, ...data, type: data.type as never } }),
  getOwnDocument: (profileId, id) => prisma.driverDocument.findFirst({ where: { id, driverId: profileId } }), // scoped to the owner
};
