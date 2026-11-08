export type RideStatus =
  | 'REQUESTED' | 'SEARCHING_FOR_DRIVER' | 'DRIVER_ASSIGNED' | 'DRIVER_ARRIVING' | 'DRIVER_ARRIVED'
  | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_DRIVER_AVAILABLE';

export const STATUS_LABEL: Record<RideStatus, string> = {
  REQUESTED: 'Requested', SEARCHING_FOR_DRIVER: 'Finding a driver', DRIVER_ASSIGNED: 'Driver assigned', DRIVER_ARRIVING: 'Driver on the way',
  DRIVER_ARRIVED: 'Driver arrived', IN_PROGRESS: 'In progress', COMPLETED: 'Completed', CANCELLED: 'Cancelled', NO_DRIVER_AVAILABLE: 'No driver available',
};
export const STATUS_TONE: Record<RideStatus, 'neutral' | 'accent' | 'success' | 'warning'> = {
  REQUESTED: 'neutral', SEARCHING_FOR_DRIVER: 'accent', DRIVER_ASSIGNED: 'accent', DRIVER_ARRIVING: 'accent', DRIVER_ARRIVED: 'accent',
  IN_PROGRESS: 'accent', COMPLETED: 'success', CANCELLED: 'neutral', NO_DRIVER_AVAILABLE: 'warning',
};
export const ACTIVE_STATUSES: RideStatus[] = ['REQUESTED', 'SEARCHING_FOR_DRIVER', 'DRIVER_ASSIGNED', 'DRIVER_ARRIVING', 'DRIVER_ARRIVED', 'IN_PROGRESS'];
export const isActiveStatus = (s: RideStatus) => ACTIVE_STATUSES.includes(s);
