import { ridesRepository as rides } from '../repositories/rides.repository';
import type { RideDetail } from '../types/ride';
import { logger } from '../utils/logger';
import { notify } from './notifications.service';
import { emitToRide, emitToUser } from './realtime.service';

const rand = (minor: number) => `R${(minor / 100).toFixed(2)}`;

async function notifyForStatus(r: RideDetail) {
  const driverName = r.driver?.fullName ?? 'Your driver';
  switch (r.status) {
    case 'DRIVER_ASSIGNED':
      if (r.driverUserId) await notify(r.driverUserId, { type: 'RIDE_OFFER', title: 'New ride request', body: `Pickup: ${r.pickup.address}. Open your dashboard to accept or decline.` });
      break;
    case 'DRIVER_ARRIVING': await notify(r.passengerUserId, { type: 'RIDE_STATUS', title: 'Your driver is on the way', body: `${driverName} accepted your ride.` }); break;
    case 'DRIVER_ARRIVED': await notify(r.passengerUserId, { type: 'RIDE_STATUS', title: 'Your driver has arrived', body: `${driverName} is at the pickup point.` }); break;
    case 'IN_PROGRESS': await notify(r.passengerUserId, { type: 'RIDE_STATUS', title: 'Trip started', body: `Heading to ${r.dropoff.address}.` }); break;
    case 'COMPLETED': await notify(r.passengerUserId, { type: 'RIDE_STATUS', title: 'Trip completed', body: `Fare ${rand(r.finalFareMinor ?? r.estimatedFareMinor)}. You can pay and rate your driver from the ride page.` }); break;
    case 'NO_DRIVER_AVAILABLE': await notify(r.passengerUserId, { type: 'RIDE_STATUS', title: 'No driver available', body: 'You can search again or cancel from the ride page.' }); break;
    case 'CANCELLED':
      if (r.cancelledBy === 'ADMIN') {
        await notify(r.passengerUserId, { type: 'RIDE_STATUS', title: 'Ride cancelled by support', body: r.cancellationReason ?? 'Your ride was cancelled.' });
        if (r.driverUserId) await notify(r.driverUserId, { type: 'RIDE_STATUS', title: 'Ride cancelled by support', body: r.cancellationReason ?? 'The ride was cancelled.' });
      } else if (r.cancelledBy === 'PASSENGER' && r.driverUserId) {
        await notify(r.driverUserId, { type: 'RIDE_STATUS', title: 'Ride cancelled', body: 'The passenger cancelled this ride.' });
      }
      break;
    default: break;
  }
}

/**
 * Call exactly when a ride's status has just changed. Pushes a minimal "something changed" event (no ride data) to the people involved,
 * who then re-fetch through the authorised REST API, and records the matching in-app notifications.
 */
export async function publishRideChange(rideId: string): Promise<void> {
  try {
    const r = await rides.getRideDetail(rideId);
    if (!r) return;
    const payload = { rideId, status: r.status, at: new Date().toISOString() };
    emitToRide(rideId, 'ride:updated', payload);
    emitToUser(r.passengerUserId, 'ride:updated', payload);
    if (r.driverUserId) emitToUser(r.driverUserId, 'ride:updated', payload);
    await notifyForStatus(r);
  } catch (err) {
    logger.warn({ err, rideId }, 'Could not publish ride change');
  }
}
