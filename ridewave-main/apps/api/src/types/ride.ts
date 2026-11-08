export type RideStatus =
  | 'REQUESTED' | 'SEARCHING_FOR_DRIVER' | 'DRIVER_ASSIGNED' | 'DRIVER_ARRIVING' | 'DRIVER_ARRIVED'
  | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_DRIVER_AVAILABLE';
export type ActorType = 'PASSENGER' | 'DRIVER' | 'ADMIN' | 'SYSTEM';

export type LatLng = { lat: number; lng: number };
export type Place = LatLng & { address: string };

/** Itemised fare. All amounts are integer minor units (cents). A type alias (not an interface) so it can be stored as JSON. */
export type FareBreakdown = {
  currency: string;
  baseFareMinor: number;
  distanceChargeMinor: number;
  timeChargeMinor: number;
  demandAdjustmentMinor: number;
  bookingFeeMinor: number;
  minimumFareTopUpMinor: number;
  roundingAdjustmentMinor: number;
  totalMinor: number;
  distanceMeters: number;
  durationSeconds: number;
};

export type FareConfig = {
  currency: string; baseFareMinor: number; perKmMinor: number; perMinuteMinor: number; minimumFareMinor: number;
  bookingFeeMinor: number; demandMultiplierBp: number; roundingMinor: number;
  cancellationFeeMinor: number; freeCancelWindowSeconds: number;
};

export type CategoryWithFare = {
  id: string; code: string; name: string; description: string; capacity: number; luggageNote: string | null; fare: FareConfig;
};

export type RideSummary = {
  id: string; status: RideStatus; categoryName: string; pickupAddress: string; dropoffAddress: string;
  currency: string; estimatedFareMinor: number; finalFareMinor: number | null; requestedAt: Date;
};

export type RideDetail = {
  id: string; status: RideStatus; passengerUserId: string; driverUserId: string | null; passengerFirstName: string; driverLocation: LatLng | null;
  category: { code: string; name: string };
  pickup: Place; dropoff: Place;
  currency: string; distanceMeters: number; durationSeconds: number;
  estimatedFareMinor: number; finalFareMinor: number | null; fareBreakdown: FareBreakdown | { type: 'CANCELLATION_FEE'; currency: string; totalMinor: number } | null;
  routeSource: string;
  requestedAt: Date; assignedAt: Date | null; arrivedAt: Date | null; startedAt: Date | null; completedAt: Date | null; cancelledAt: Date | null;
  cancellationReason: string | null; cancelledBy: ActorType | null;
  statusHistory: Array<{ fromStatus: RideStatus | null; toStatus: RideStatus; actorType: ActorType; note: string | null; createdAt: Date }>;
  driver: { fullName: string; ratingAverage: number; ratingCount: number; vehicle: { make: string; model: string; colour: string; registration: string } | null } | null;
  hasReview: boolean;
  cancellationPolicy: { feeMinor: number; freeWindowSeconds: number };
};

export type MatchingInfo = {
  id: string; status: RideStatus; categoryId: string; pickup: LatLng; declinedBy: string[];
  assignedAt: Date | null; driverProfileId: string | null; searchStartedAt: Date;
};
export type Candidate = { driverProfileId: string; vehicleId: string; lat: number; lng: number };
