import type { RideStatus } from '../../lib/ride-status';
export type { Paged } from '../rides/types';

export type Overview = { totalUsers: number; passengers: number; drivers: number; pendingDriverApprovals: number; activeRides: number; completedRides: number; cancelledRides: number; revenueMinor: number };
export type AdminRide = { id: string; status: RideStatus; categoryName: string; passengerName: string; driverName: string | null; pickupAddress: string; dropoffAddress: string; estimatedFareMinor: number; finalFareMinor: number | null; requestedAt: string };
export type TopDriver = { driverId: string; name: string; approvalStatus: string; isOnline: boolean; ratingAverage: number; ratingCount: number; completedTrips: number; grossMinor: number };
export type Analytics = {
  generatedAt: string; days: number; overview: Overview; recentRides: AdminRide[]; topDrivers: TopDriver[]; notes: { revenue: string; volume: string };
  volume: Array<{ date: string; requested: number; completed: number; cancelled: number; revenueMinor: number }>;
};
export type AdminUser = { id: string; email: string; fullName: string; role: string; status: string; createdAt: string };
export type AdminDriver = { id: string; userId: string; fullName: string; email: string; phone: string | null; approvalStatus: string; approvalNote: string | null; isOnline: boolean; ratingAverage: number; ratingCount: number; vehicleCount: number; documentCount: number };
export type AdminVehicle = { id: string; driverName: string; make: string; model: string; year: number; colour: string; registration: string; passengerCapacity: number; isActive: boolean; categoryName: string };
export type DriverDocument = { id: string; type: string; status: string; originalName: string; mimeType: string; sizeBytes: number; reviewNote: string | null; createdAt: string; reviewedAt: string | null };
export type AdminDriverDetail = AdminDriver & { vehicles: AdminVehicle[]; documents: DriverDocument[] };
export type CategoryRow = { id: string; code: string; name: string; description: string; capacity: number; isActive: boolean };
export type PricingRow = { id: string; categoryCode: string; categoryName: string; currency: string; baseFareMinor: number; perKmMinor: number; perMinuteMinor: number; minimumFareMinor: number; bookingFeeMinor: number; cancellationFeeMinor: number; freeCancelWindowSeconds: number; demandMultiplierBp: number; roundingMinor: number };
export type Ticket = { id: string; name: string; email: string; subject: string; message: string; status: string; createdAt: string };
export type ReviewRow = { id: string; rideId: string; rating: number; comment: string | null; authorName: string; subjectName: string; createdAt: string };
export type AuditRow = { id: string; actorEmail: string | null; action: string; entityType: string; entityId: string | null; metadata: unknown; createdAt: string };
