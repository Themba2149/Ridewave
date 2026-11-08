import { haversineMeters } from '../providers/dev-map-provider';
import { ridesRepository as rides } from '../repositories/rides.repository';
import type { Candidate, LatLng } from '../types/ride';
import { publishRideChange } from './ride-events.service';
import { getSettings } from './settings.service';

// Offer timeout, search timeout and pickup radius come from the platform settings (admin-editable, see settings.service).

/** Pure and deterministic: nearest driver first; ties broken by driver id. Drivers beyond the radius are dropped. */
export function rankCandidates(candidates: Candidate[], pickup: LatLng, radiusMeters: number): Candidate[] {
  return candidates
    .map((c) => ({ c, d: haversineMeters(pickup, c) }))
    .filter((x) => x.d <= radiusMeters)
    .sort((a, b) => a.d - b.d || a.c.driverProfileId.localeCompare(b.c.driverProfileId))
    .map((x) => x.c);
}

/**
 * Offer a searching ride to the best eligible driver. The claim is atomic, so if another passenger grabs the same driver first
 * we simply try the next candidate. With nobody available for long enough the ride becomes NO_DRIVER_AVAILABLE.
 */
export async function tryMatch(rideId: string): Promise<void> {
  const info = await rides.getMatchingInfo(rideId);
  if (!info || info.status !== 'SEARCHING_FOR_DRIVER') return;
  const settings = (await getSettings()).values;
  const candidates = rankCandidates(await rides.findCandidateDrivers(info.categoryId, info.declinedBy), info.pickup, settings.maxPickupRadiusMeters);
  for (const c of candidates) {
    if (await rides.claimDriver({ rideId, driverProfileId: c.driverProfileId, vehicleId: c.vehicleId, assignedAt: new Date() })) { await publishRideChange(rideId); return; }
  }
  if (Date.now() - info.searchStartedAt.getTime() > settings.searchTimeoutSeconds * 1000) {
    const changed = await rides.transitionRide({ rideId, from: 'SEARCHING_FOR_DRIVER', to: 'NO_DRIVER_AVAILABLE', actorType: 'SYSTEM', note: 'No eligible driver became available' });
    if (changed) await publishRideChange(rideId);
  }
}

/**
 * Advance a ride that is waiting on matching: expire an unanswered offer, then (re)try matching.
 * There is no background worker yet: this runs whenever a passenger or driver loads the ride (polling), and when a driver goes online.
 */
export async function refreshRide(rideId: string): Promise<void> {
  const info = await rides.getMatchingInfo(rideId);
  if (!info) return;
  const offerTtlMs = (await getSettings()).values.offerTtlSeconds * 1000;
  if (info.status === 'DRIVER_ASSIGNED' && info.assignedAt && info.driverProfileId && Date.now() - info.assignedAt.getTime() > offerTtlMs) {
    const released = await rides.transitionRide({
      rideId, from: 'DRIVER_ASSIGNED', to: 'SEARCHING_FOR_DRIVER', actorType: 'SYSTEM', note: 'Driver did not respond in time', requireDriverId: info.driverProfileId,
      data: { driverId: null, vehicleId: null, assignedAt: null, declinedBy: [...info.declinedBy, info.driverProfileId].join(',') },
    });
    if (released) { await publishRideChange(rideId); await tryMatch(rideId); }
    return;
  }
  if (info.status === 'SEARCHING_FOR_DRIVER') await tryMatch(rideId);
}

/** Called when a driver comes online: offer them to rides that were already waiting. */
export async function matchWaitingRides(): Promise<void> {
  for (const id of await rides.listSearchingRideIds(20)) await tryMatch(id);
}
