import type { RideStatus } from '../types/ride';
import { AppError } from '../utils/errors';

/** Permitted ride status transitions. Enforced on the server for every status change. */
export const TRANSITIONS: Record<RideStatus, readonly RideStatus[]> = {
  REQUESTED: ['SEARCHING_FOR_DRIVER', 'CANCELLED'],
  SEARCHING_FOR_DRIVER: ['DRIVER_ASSIGNED', 'NO_DRIVER_AVAILABLE', 'CANCELLED'],
  DRIVER_ASSIGNED: ['DRIVER_ARRIVING', 'SEARCHING_FOR_DRIVER', 'CANCELLED'],
  DRIVER_ARRIVING: ['DRIVER_ARRIVED', 'SEARCHING_FOR_DRIVER', 'CANCELLED'],
  DRIVER_ARRIVED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
  NO_DRIVER_AVAILABLE: ['SEARCHING_FOR_DRIVER', 'CANCELLED'],
};

/** A passenger may have only one of these at a time. NO_DRIVER_AVAILABLE is excluded: it is waiting for a retry or cancel. */
export const ACTIVE_STATUSES: readonly RideStatus[] = ['REQUESTED', 'SEARCHING_FOR_DRIVER', 'DRIVER_ASSIGNED', 'DRIVER_ARRIVING', 'DRIVER_ARRIVED', 'IN_PROGRESS'];
/** The passenger can cancel until the trip starts. */
export const PASSENGER_CANCELLABLE: readonly RideStatus[] = ['REQUESTED', 'SEARCHING_FOR_DRIVER', 'DRIVER_ASSIGNED', 'DRIVER_ARRIVING', 'DRIVER_ARRIVED', 'NO_DRIVER_AVAILABLE'];

export const canTransition = (from: RideStatus, to: RideStatus) => TRANSITIONS[from].includes(to);

export function assertTransition(from: RideStatus, to: RideStatus) {
  if (!canTransition(from, to)) throw AppError.invalidState(`A ride that is ${from.toLowerCase().replace(/_/g, ' ')} cannot become ${to.toLowerCase().replace(/_/g, ' ')}.`);
}
