import type { RideStatus } from './ride';

export type Page<T> = { items: T[]; total: number };

export type Overview = {
  totalUsers: number; passengers: number; drivers: number; pendingDriverApprovals: number;
  activeRides: number; completedRides: number; cancelledRides: number; revenueMinor: number;
};
export type RideStamp = { requestedAt: Date; completedAt: Date | null; status: RideStatus; finalFareMinor: number | null };
export type AdminRideRow = {
  id: string; status: RideStatus; categoryName: string; passengerName: string; driverName: string | null; pickupAddress: string; dropoffAddress: string;
  estimatedFareMinor: number; finalFareMinor: number | null; requestedAt: Date;
};
export type DriverPerfRow = { driverId: string; name: string; approvalStatus: string; isOnline: boolean; ratingAverage: number; ratingCount: number; completedTrips: number; grossMinor: number };

export type DocumentRow = {
  id: string; driverId: string; type: string; status: string; originalName: string; storageKey: string; mimeType: string; sizeBytes: number;
  reviewNote: string | null; createdAt: Date; reviewedAt: Date | null;
};
export type AdminVehicleRow = { id: string; driverName: string; make: string; model: string; year: number; colour: string; registration: string; passengerCapacity: number; isActive: boolean; categoryName: string };
export type AdminDriverRow = {
  id: string; userId: string; fullName: string; email: string; phone: string | null; approvalStatus: string; approvalNote: string | null;
  isOnline: boolean; ratingAverage: number; ratingCount: number; vehicleCount: number; documentCount: number; createdAt: Date;
};
export type AdminDriverDetail = AdminDriverRow & { vehicles: AdminVehicleRow[]; documents: Omit<DocumentRow, 'storageKey'>[] };

export type CategoryRow = { id: string; code: string; name: string; description: string; capacity: number; luggageNote: string | null; isActive: boolean; sortOrder: number };
export type PricingRow = {
  id: string; categoryId: string; categoryCode: string; categoryName: string; currency: string; baseFareMinor: number; perKmMinor: number; perMinuteMinor: number;
  minimumFareMinor: number; bookingFeeMinor: number; cancellationFeeMinor: number; freeCancelWindowSeconds: number; demandMultiplierBp: number; roundingMinor: number;
};
export type PricingFields = Omit<PricingRow, 'id' | 'categoryId' | 'categoryCode' | 'categoryName' | 'currency'>;
export type TicketRow = { id: string; name: string; email: string; subject: string; message: string; status: string; createdAt: Date };
export type ReviewRow = { id: string; rideId: string; rating: number; comment: string | null; authorName: string; subjectName: string; createdAt: Date };
export type AuditEntry = { actorId: string | null; action: string; entityType: string; entityId?: string | null; metadata?: Record<string, unknown>; ipAddress?: string | null };
export type AuditRow = { id: string; actorEmail: string | null; action: string; entityType: string; entityId: string | null; metadata: unknown; createdAt: Date };
