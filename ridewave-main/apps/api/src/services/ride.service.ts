import { getMapProvider } from '../providers/map-provider';
import { haversineMeters } from '../providers/dev-map-provider';
import { paymentsRepository as paymentsRepo } from '../repositories/payments.repository';
import { currentPayment, toPaymentDto, toPaymentSummary } from './payment-dto';
import { ridesRepository as repo, type SavedLocationRow } from '../repositories/rides.repository';
import type { UserRecord } from '../types/auth';
import type { Place, RideDetail } from '../types/ride';
import { AppError } from '../utils/errors';
import { calculateFare } from './pricing.service';
import { inServiceArea } from './geo';
import { refreshRide, tryMatch } from './matching.service';
import { publishRideChange } from './ride-events.service';
import { getSettings } from './settings.service';
import { assertTransition, PASSENGER_CANCELLABLE } from './ride-state';

const MIN_TRIP_METERS = 100;
const MAX_SAVED_LOCATIONS = 20;


function validateTrip(pickup: Place, dropoff: Place) {
  if (!inServiceArea(pickup) || !inServiceArea(dropoff)) throw AppError.validation('Both locations must be inside the Johannesburg service area.');
  if (haversineMeters(pickup, dropoff) < MIN_TRIP_METERS) throw AppError.validation('Pickup and destination are too close together.');
}

async function requirePassengerProfileId(user: UserRecord): Promise<string> {
  const id = await repo.getPassengerProfileId(user.id);
  if (!id) throw AppError.forbidden('Only passengers can do that.');
  return id;
}

/** Fares are always calculated here from server-side configuration. The client never supplies a fare, distance or duration. */
export async function estimateRides(pickup: Place, dropoff: Place) {
  validateTrip(pickup, dropoff);
  const provider = getMapProvider();
  const route = await provider.estimateRoute(pickup, dropoff);
  const categories = await repo.listCategoriesWithFare();
  return {
    isEstimate: true,
    route: { ...route, isLive: provider.isLive },
    options: categories.map((c) => ({
      code: c.code, name: c.name, description: c.description, capacity: c.capacity, luggageNote: c.luggageNote,
      fare: calculateFare(c.fare, route.distanceMeters, route.durationSeconds),
    })),
  };
}

export async function createRide(user: UserRecord, input: { pickup: Place; dropoff: Place; categoryCode: string; idempotencyKey: string }) {
  const passengerProfileId = await requirePassengerProfileId(user);

  const duplicate = await repo.findRideByIdempotencyKey(passengerProfileId, input.idempotencyKey);
  if (duplicate) return { id: duplicate.id, created: false }; // same submission repeated: return the original, never a second ride

  const activeId = await repo.findActiveRideId(passengerProfileId);
  if (activeId) throw new AppError(409, 'CONFLICT', 'You already have an active ride. Finish or cancel it before booking another.', { rideId: activeId });

  const category = await repo.findCategoryWithFare(input.categoryCode);
  if (!category) throw AppError.validation('That ride category is not available.');
  validateTrip(input.pickup, input.dropoff);

  const route = await getMapProvider().estimateRoute(input.pickup, input.dropoff);
  const fare = calculateFare(category.fare, route.distanceMeters, route.durationSeconds);
  const ride = await repo.createRide({
    passengerProfileId, passengerUserId: user.id, categoryId: category.id, idempotencyKey: input.idempotencyKey,
    pickup: input.pickup, dropoff: input.dropoff, currency: fare.currency,
    distanceMeters: fare.distanceMeters, durationSeconds: fare.durationSeconds, estimatedFareMinor: fare.totalMinor, fareBreakdown: fare, routeSource: route.source,
  });
  await publishRideChange(ride.id);
  await tryMatch(ride.id); // offer to the nearest eligible driver right away
  return { id: ride.id, created: true };
}

/** Participants only. Anyone else gets "not found" so ride ids cannot be probed. */
export async function getRideForUser(user: UserRecord, rideId: string): Promise<RideDetail> {
  const ride = await repo.getRideDetail(rideId);
  const allowed = ride && (user.role === 'ADMIN' || ride.passengerUserId === user.id || ride.driverUserId === user.id);
  if (!ride || !allowed) throw AppError.notFound('Ride not found.');
  return ride;
}

/** Shape returned to clients: internal user ids are removed. */
export function toRideDto(ride: RideDetail) {
  const { passengerUserId: _p, driverUserId: _d, driverLocation: _l, ...rest } = ride;
  void _p; void _d; void _l;
  return rest;
}

/** Ride as shown to a participant: advances matching lazily (polling-driven dispatch) and adds a driver ETA when one can be estimated. */
export async function getRideView(user: UserRecord, rideId: string) {
  const first = await getRideForUser(user, rideId);
  const participant = first.passengerUserId === user.id || first.driverUserId === user.id;
  if (participant) await refreshRide(rideId);
  const ride = participant ? await getRideForUser(user, rideId) : first;

  let etaSeconds: number | null = null;
  if ((ride.status === 'DRIVER_ASSIGNED' || ride.status === 'DRIVER_ARRIVING') && ride.driverLocation) {
    etaSeconds = (await getMapProvider().estimateRoute(ride.driverLocation, ride.pickup)).durationSeconds;
  }
  const offerExpiresAt = ride.status === 'DRIVER_ASSIGNED' && ride.assignedAt ? new Date(ride.assignedAt.getTime() + (await getSettings()).values.offerTtlSeconds * 1000) : null;
  const payment = toPaymentSummary(currentPayment(await paymentsRepo.findByRide(rideId)));
  return { ...toRideDto(ride), driverEtaSeconds: etaSeconds, driverEtaIsEstimate: etaSeconds !== null, offerExpiresAt, payment };
}

/** Passenger asks to search again after NO_DRIVER_AVAILABLE. */
export async function retryRide(user: UserRecord, rideId: string) {
  const ride = await getRideForUser(user, rideId);
  if (ride.passengerUserId !== user.id) throw AppError.forbidden('Only the passenger can retry this ride.');
  if (ride.status !== 'NO_DRIVER_AVAILABLE') throw AppError.invalidState('Only a ride with no driver available can be retried.');
  assertTransition(ride.status, 'SEARCHING_FOR_DRIVER');
  const pid = await requirePassengerProfileId(user);
  if (await repo.findActiveRideId(pid)) throw AppError.conflict('You already have an active ride.');
  const ok = await repo.transitionRide({ rideId, from: 'NO_DRIVER_AVAILABLE', to: 'SEARCHING_FOR_DRIVER', actorType: 'PASSENGER', actorId: user.id, note: 'Passenger retried', data: { declinedBy: '' } });
  if (!ok) throw AppError.invalidState('This ride just changed. Refresh and try again.');
  await publishRideChange(rideId);
  await tryMatch(rideId);
  return getRideView(user, rideId);
}

export async function cancelRide(user: UserRecord, rideId: string, reason?: string) {
  const ride = await getRideForUser(user, rideId);
  if (ride.passengerUserId !== user.id) throw AppError.forbidden('Only the passenger can cancel this ride.');
  if (!PASSENGER_CANCELLABLE.includes(ride.status)) throw AppError.invalidState('This ride can no longer be cancelled.');
  assertTransition(ride.status, 'CANCELLED');

  // A fee can apply only after a driver has ACCEPTED (driver on the way / arrived), measured from the moment they accepted.
  const driverCommitted = ride.status === 'DRIVER_ARRIVING' || ride.status === 'DRIVER_ARRIVED';
  const acceptedAt = [...ride.statusHistory].reverse().find((h) => h.toStatus === 'DRIVER_ARRIVING')?.createdAt;
  const pastFreeWindow = !!acceptedAt && Date.now() - acceptedAt.getTime() > ride.cancellationPolicy.freeWindowSeconds * 1000;
  const feeMinor = driverCommitted && pastFreeWindow ? ride.cancellationPolicy.feeMinor : 0;

  const ok = await repo.transitionRide({
    rideId, from: ride.status, to: 'CANCELLED', actorType: 'PASSENGER', actorId: user.id, note: reason,
    data: {
      cancelledAt: new Date(), cancelledBy: 'PASSENGER', cancellationReason: reason,
      ...(feeMinor > 0 ? { finalFareMinor: feeMinor, fareBreakdown: { type: 'CANCELLATION_FEE' as const, currency: ride.currency, totalMinor: feeMinor } } : {}),
    },
  });
  if (!ok) throw AppError.invalidState('This ride just changed. Refresh and try again.');
  await publishRideChange(rideId);
  return { ride: await getRideView(user, rideId), cancellationFeeMinor: feeMinor };
}

export async function listMyRides(user: UserRecord, q: { scope: 'active' | 'past' | 'all'; page: number; pageSize: number }) {
  const pid = await requirePassengerProfileId(user);
  const { items, total } = await repo.listPassengerRides(pid, q);
  return { items, page: q.page, pageSize: q.pageSize, total };
}

export async function getReceipt(user: UserRecord, rideId: string) {
  const ride = await getRideForUser(user, rideId);
  if (user.role !== 'ADMIN' && ride.passengerUserId !== user.id) throw AppError.forbidden('Only the passenger can view this receipt.');
  if (ride.status !== 'COMPLETED' || ride.finalFareMinor === null || !ride.fareBreakdown || 'type' in ride.fareBreakdown) {
    throw AppError.invalidState('Receipts are available for completed rides only.');
  }
  return {
    receiptNumber: `RW-${ride.id.slice(-8).toUpperCase()}`,
    issuedAt: ride.completedAt,
    ride: toRideDto(ride),
    totalMinor: ride.finalFareMinor,
    payment: await (async () => { const p = currentPayment(await paymentsRepo.findByRide(rideId)); return p ? toPaymentDto(p) : null; })(),
  };
}

export async function submitReview(user: UserRecord, rideId: string, input: { rating: number; comment?: string }) {
  const ride = await getRideForUser(user, rideId);
  if (ride.passengerUserId !== user.id) throw AppError.forbidden('Only the passenger can review this ride.');
  if (ride.status !== 'COMPLETED' || !ride.driverUserId) throw AppError.invalidState('You can review a ride once it is completed.');
  if (ride.hasReview) throw AppError.conflict('You have already reviewed this ride.');
  await repo.createReview({ rideId, authorUserId: user.id, subjectUserId: ride.driverUserId, rating: input.rating, comment: input.comment });
}

export async function listSavedLocations(user: UserRecord): Promise<SavedLocationRow[]> {
  return repo.listSavedLocations(await requirePassengerProfileId(user));
}
export async function createSavedLocation(user: UserRecord, data: { label: string; address: string; lat: number; lng: number; isFavorite: boolean }) {
  const pid = await requirePassengerProfileId(user);
  if (!inServiceArea(data)) throw AppError.validation('That location is outside the Johannesburg service area.');
  if ((await repo.countSavedLocations(pid)) >= MAX_SAVED_LOCATIONS) throw AppError.conflict(`You can save up to ${MAX_SAVED_LOCATIONS} places. Delete one first.`);
  return repo.createSavedLocation(pid, data);
}
export async function deleteSavedLocation(user: UserRecord, id: string) {
  const pid = await requirePassengerProfileId(user);
  if (!(await repo.deleteSavedLocation(pid, id))) throw AppError.notFound('Saved place not found.');
}
