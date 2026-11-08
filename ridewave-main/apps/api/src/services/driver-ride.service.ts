import { driversRepository as drivers } from '../repositories/drivers.repository';
import { ridesRepository as repo } from '../repositories/rides.repository';
import type { UserRecord } from '../types/auth';
import type { RideDetail } from '../types/ride';
import { AppError } from '../utils/errors';
import { requireDriver } from './driver.service';
import { refreshRide, tryMatch } from './matching.service';
import { publishRideChange } from './ride-events.service';
import { getSettings } from './settings.service';
import { calculateFare } from './pricing.service';
import { assertTransition } from './ride-state';
import { getRideView } from './ride.service';

/** Only the driver assigned to the ride may act on it. Anyone else gets "not found". */
async function loadOwnRide(user: UserRecord, rideId: string): Promise<{ ride: RideDetail; driverProfileId: string }> {
  const ctx = await requireDriver(user);
  const ride = await repo.getRideDetail(rideId);
  if (!ride || ride.driverUserId !== user.id) throw AppError.notFound('Ride not found.');
  return { ride, driverProfileId: ctx.id };
}

async function advance(user: UserRecord, rideId: string, to: 'DRIVER_ARRIVING' | 'DRIVER_ARRIVED' | 'IN_PROGRESS', from: RideDetail['status'], data: Parameters<typeof repo.transitionRide>[0]['data'], note: string) {
  const { ride, driverProfileId } = await loadOwnRide(user, rideId);
  assertTransition(ride.status, to);
  if (ride.status !== from) throw AppError.invalidState(`This ride is ${ride.status.toLowerCase().replace(/_/g, ' ')}, so you cannot do that now.`);
  const ok = await repo.transitionRide({ rideId, from, to, actorType: 'DRIVER', actorId: user.id, requireDriverId: driverProfileId, note, data });
  if (!ok) throw AppError.invalidState('This ride just changed. Refresh and try again.');
  await publishRideChange(rideId);
  return getRideView(user, rideId);
}

export async function acceptRide(user: UserRecord, rideId: string) {
  const { ride } = await loadOwnRide(user, rideId);
  if (ride.status === 'DRIVER_ASSIGNED' && ride.assignedAt && Date.now() - ride.assignedAt.getTime() > (await getSettings()).values.offerTtlSeconds * 1000) {
    await refreshRide(rideId);
    throw AppError.invalidState('This request has expired and was offered to another driver.');
  }
  return advance(user, rideId, 'DRIVER_ARRIVING', 'DRIVER_ASSIGNED', {}, 'Driver accepted and is on the way');
}

export async function declineRide(user: UserRecord, rideId: string) {
  const { ride, driverProfileId } = await loadOwnRide(user, rideId);
  assertTransition(ride.status, 'SEARCHING_FOR_DRIVER');
  if (ride.status !== 'DRIVER_ASSIGNED') throw AppError.invalidState('Only a pending request can be declined.');
  const info = await repo.getMatchingInfo(rideId);
  const ok = await repo.transitionRide({
    rideId, from: 'DRIVER_ASSIGNED', to: 'SEARCHING_FOR_DRIVER', actorType: 'DRIVER', actorId: user.id, requireDriverId: driverProfileId, note: 'Driver declined',
    data: { driverId: null, vehicleId: null, assignedAt: null, declinedBy: [...(info?.declinedBy ?? []), driverProfileId].join(',') },
  });
  if (!ok) throw AppError.invalidState('This request is no longer available.');
  await publishRideChange(rideId);
  await tryMatch(rideId); // offer to the next eligible driver straight away
  return { declined: true };
}

export const arriveAtPickup = (user: UserRecord, rideId: string) => advance(user, rideId, 'DRIVER_ARRIVED', 'DRIVER_ARRIVING', { arrivedAt: new Date() }, 'Driver arrived at pickup');
export const startTrip = (user: UserRecord, rideId: string) => advance(user, rideId, 'IN_PROGRESS', 'DRIVER_ARRIVED', { startedAt: new Date() }, 'Trip started');

/**
 * Completing recalculates the fare on the server. There is no GPS metering yet, so distance is the booked route distance and
 * time never bills below the estimate (a long real trip bills its real time). Uses the category's current fare configuration.
 */
export async function completeTrip(user: UserRecord, rideId: string) {
  const { ride, driverProfileId } = await loadOwnRide(user, rideId);
  assertTransition(ride.status, 'COMPLETED');
  if (ride.status !== 'IN_PROGRESS' || !ride.startedAt) throw AppError.invalidState('Only a trip in progress can be completed.');
  const category = await repo.findCategoryWithFare(ride.category.code);
  if (!category) throw AppError.invalidState('Fare configuration for this ride is unavailable.');
  const now = new Date();
  const elapsedSeconds = Math.max(0, Math.round((now.getTime() - ride.startedAt.getTime()) / 1000));
  const fare = calculateFare(category.fare, ride.distanceMeters, Math.min(Math.max(ride.durationSeconds, elapsedSeconds), 24 * 3600));
  const ok = await repo.transitionRide({
    rideId, from: 'IN_PROGRESS', to: 'COMPLETED', actorType: 'DRIVER', actorId: user.id, requireDriverId: driverProfileId, note: 'Trip completed',
    data: { completedAt: now, finalFareMinor: fare.totalMinor, fareBreakdown: fare },
  });
  if (!ok) throw AppError.invalidState('This ride just changed. Refresh and try again.');
  await publishRideChange(rideId);
  return getRideView(user, rideId);
}

export async function listDriverRides(user: UserRecord, q: { scope: 'active' | 'past' | 'all'; page: number; pageSize: number }) {
  const ctx = await requireDriver(user);
  const { items, total } = await drivers.listRides(ctx.id, q);
  return { items, page: q.page, pageSize: q.pageSize, total };
}
