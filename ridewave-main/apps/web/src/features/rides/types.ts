import type { RideStatus } from '../../lib/ride-status';

export type PlaceValue = { address: string; lat: number; lng: number };
export type FareBreakdown = {
  currency: string; baseFareMinor: number; distanceChargeMinor: number; timeChargeMinor: number; demandAdjustmentMinor: number; bookingFeeMinor: number;
  minimumFareTopUpMinor: number; roundingAdjustmentMinor: number; totalMinor: number; distanceMeters: number; durationSeconds: number;
};
export type EstimateOption = { code: string; name: string; description: string; capacity: number; luggageNote: string | null; fare: FareBreakdown };
export type Estimate = { isEstimate: true; route: { distanceMeters: number; durationSeconds: number; source: string; isLive: boolean }; options: EstimateOption[] };
export type RideSummary = {
  id: string; status: RideStatus; categoryName: string; pickupAddress: string; dropoffAddress: string;
  currency: string; estimatedFareMinor: number; finalFareMinor: number | null; requestedAt: string;
};
export type RideDetail = {
  id: string; status: RideStatus; category: { code: string; name: string }; pickup: PlaceValue; dropoff: PlaceValue;
  currency: string; distanceMeters: number; durationSeconds: number; estimatedFareMinor: number; finalFareMinor: number | null;
  fareBreakdown: FareBreakdown | { type: 'CANCELLATION_FEE'; currency: string; totalMinor: number } | null; routeSource: string;
  requestedAt: string; assignedAt: string | null; completedAt: string | null; cancelledAt: string | null; cancellationReason: string | null; cancelledBy: string | null;
  statusHistory: Array<{ fromStatus: RideStatus | null; toStatus: RideStatus; actorType: string; note: string | null; createdAt: string }>;
  driver: { fullName: string; ratingAverage: number; ratingCount: number; vehicle: { make: string; model: string; colour: string; registration: string } | null } | null;
  hasReview: boolean; cancellationPolicy: { feeMinor: number; freeWindowSeconds: number };
  passengerFirstName: string; driverEtaSeconds: number | null; driverEtaIsEstimate: boolean; offerExpiresAt: string | null;
  payment: { id: string; method: 'CASH' | 'CARD' | 'DIGITAL_WALLET'; status: 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED'; isSimulated: boolean } | null;
};
export type SavedLocation = { id: string; label: string; address: string; lat: number; lng: number; isFavorite: boolean };
export type PlaceSuggestion = { id: string; name: string; address: string; lat: number; lng: number };
export type Paged<T> = { items: T[]; page: number; pageSize: number; total: number };
