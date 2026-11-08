import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api-client';
import { realtimeState } from '../../lib/realtime';
import { isActiveStatus } from '../../lib/ride-status';
import type { Estimate, Paged, PlaceSuggestion, PlaceValue, RideDetail, RideSummary, SavedLocation } from './types';

export type Scope = 'active' | 'past' | 'all';

export const useMyRides = (scope: Scope, page = 1, pageSize = 10) =>
  useQuery({ queryKey: ['rides', scope, page, pageSize], queryFn: () => apiFetch<Paged<RideSummary>>(`/passengers/me/rides?scope=${scope}&page=${page}&pageSize=${pageSize}`), placeholderData: keepPreviousData });

/** Live events refresh this instantly; polling (5 s, or 30 s while the live channel is connected) is the fallback. */
export const useRide = (id: string) =>
  useQuery({
    queryKey: ['ride', id],
    queryFn: async () => (await apiFetch<{ ride: RideDetail }>(`/rides/${id}`)).ride,
    refetchInterval: (q) => (q.state.data && isActiveStatus(q.state.data.status) ? (realtimeState.connected ? 30_000 : 5000) : false),
  });

export const useEstimate = () =>
  useMutation({ mutationFn: (v: { pickup: PlaceValue; dropoff: PlaceValue }) => apiFetch<Estimate>('/rides/estimate', { method: 'POST', body: JSON.stringify(v) }) });

export function useCreateRide() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { pickup: PlaceValue; dropoff: PlaceValue; categoryCode: string; idempotencyKey: string }) =>
      apiFetch<{ ride: RideDetail; duplicate: boolean }>('/rides', { method: 'POST', body: JSON.stringify(v) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rides'] }),
  });
}

export function useCancelRide(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason?: string) => apiFetch<{ ride: RideDetail; cancellationFeeMinor: number }>(`/rides/${id}/cancel`, { method: 'POST', body: JSON.stringify(reason ? { reason } : {}) }),
    onSuccess: (d) => { qc.setQueryData(['ride', id], d.ride); qc.invalidateQueries({ queryKey: ['rides'] }); },
  });
}

export function useSubmitReview(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { rating: number; comment?: string }) => apiFetch<{ message: string }>(`/rides/${id}/reviews`, { method: 'POST', body: JSON.stringify(v) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ride', id] }),
  });
}

export const useReceipt = (id: string) =>
  useQuery({
    queryKey: ['receipt', id],
    queryFn: () => apiFetch<{ receiptNumber: string; issuedAt: string; totalMinor: number; ride: RideDetail; payment: unknown }>(`/rides/${id}/receipt`),
  });

export const useSavedLocations = () =>
  useQuery({ queryKey: ['saved-locations'], queryFn: async () => (await apiFetch<{ items: SavedLocation[] }>('/passengers/me/saved-locations')).items });

export function useAddSavedLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { label: string; address: string; lat: number; lng: number; isFavorite: boolean }) =>
      apiFetch('/passengers/me/saved-locations', { method: 'POST', body: JSON.stringify(v) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved-locations'] }),
  });
}
export function useDeleteSavedLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/passengers/me/saved-locations/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved-locations'] }),
  });
}

export const usePlaceSearch = (q: string) =>
  useQuery({
    queryKey: ['places', q],
    queryFn: () => apiFetch<{ places: PlaceSuggestion[]; provider: { id: string; isLive: boolean } }>(`/places/search?q=${encodeURIComponent(q)}`),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

export function useRetryRide(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<{ ride: RideDetail }>(`/rides/${id}/retry`, { method: 'POST' }),
    onSuccess: (d) => { qc.setQueryData(['ride', id], d.ride); qc.invalidateQueries({ queryKey: ['rides'] }); },
  });
}
