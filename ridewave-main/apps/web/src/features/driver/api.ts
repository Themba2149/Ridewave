import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api-client';
import type { Paged, PlaceValue } from '../rides/types';
import type { RideStatus } from '../../lib/ride-status';

export type DriverVehicle = { id: string; make: string; model: string; year: number; colour: string; registration: string; passengerCapacity: number; isActive: boolean; category: { code: string; name: string } };
export type DriverMe = {
  profile: { approvalStatus: string; isOnline: boolean; ratingAverage: number; ratingCount: number; location: { lat: number; lng: number } | null; vehicles: Array<Pick<DriverVehicle, 'id' | 'make' | 'model' | 'year' | 'registration'>> };
};
export type RideOffer = {
  rideId: string; passengerFirstName: string; category: string; pickup: PlaceValue; dropoff: PlaceValue; distanceMeters: number; durationSeconds: number;
  estimatedFareMinor: number; estimatedEarningsMinor: number; pickupEtaSeconds: number | null; offerExpiresAt: string;
};
export type DriverRideSummary = { id: string; status: RideStatus; categoryName: string; pickupAddress: string; dropoffAddress: string; currency: string; estimatedFareMinor: number; finalFareMinor: number | null; requestedAt: string; completedAt: string | null; payment: { method: string; status: string } | null };
export type Earnings = {
  period: 'day' | 'week' | 'month'; trips: number; grossMinor: number; commissionMinor: number; netMinor: number; commission: { rateBp: number; isDemonstrationRate: boolean };
  daily: Array<{ date: string; trips: number; grossMinor: number; netMinor: number }>;
  stats: { completedTripsAllTime: number; offersAccepted: number; offersDeclined: number; acceptanceRatePercent: number | null };
};

export const useDriverMe = () => useQuery({ queryKey: ['driver-me'], queryFn: () => apiFetch<DriverMe>('/drivers/me') });

export function useSetAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { isOnline: boolean; lat?: number; lng?: number }) => apiFetch<{ isOnline: boolean }>('/drivers/me/availability', { method: 'PATCH', body: JSON.stringify(v) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['driver-me'] }); qc.invalidateQueries({ queryKey: ['driver-requests'] }); qc.invalidateQueries({ queryKey: ['driver-rides'] }); },
  });
}

/** Polling fallback for new requests while online (real-time push arrives in a later phase). */
export const useDriverRequests = (online: boolean) =>
  useQuery({ queryKey: ['driver-requests'], queryFn: async () => (await apiFetch<{ items: RideOffer[] }>('/drivers/me/ride-requests')).items, enabled: online, refetchInterval: online ? 5000 : false });

export const useDriverRides = (scope: 'active' | 'past' | 'all', page = 1, pageSize = 10, poll = false) =>
  useQuery({
    queryKey: ['driver-rides', scope, page, pageSize],
    queryFn: () => apiFetch<Paged<DriverRideSummary>>(`/drivers/me/rides?scope=${scope}&page=${page}&pageSize=${pageSize}`),
    placeholderData: keepPreviousData, refetchInterval: poll ? 5000 : false,
  });

export type RideAction = 'accept' | 'decline' | 'arrive' | 'start' | 'complete';
export function useRideAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ rideId, action }: { rideId: string; action: RideAction }) => apiFetch<unknown>(`/rides/${rideId}/${action}`, { method: 'POST' }),
    onSettled: () => { for (const k of ['driver-requests', 'driver-rides', 'ride', 'driver-earnings']) qc.invalidateQueries({ queryKey: [k] }); },
  });
}

export const useDriverEarnings = (period: 'day' | 'week' | 'month') =>
  useQuery({ queryKey: ['driver-earnings', period], queryFn: () => apiFetch<Earnings>(`/drivers/me/earnings?period=${period}`) });

export const useVehicles = () => useQuery({ queryKey: ['driver-vehicles'], queryFn: async () => (await apiFetch<{ items: DriverVehicle[] }>('/drivers/me/vehicles')).items });

export function useAddVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { categoryCode: string; make: string; model: string; year: number; colour: string; registration: string; passengerCapacity: number }) =>
      apiFetch('/drivers/me/vehicles', { method: 'POST', body: JSON.stringify(v) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['driver-vehicles'] }); qc.invalidateQueries({ queryKey: ['driver-me'] }); },
  });
}
