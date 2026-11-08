import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api-client';

export type PublicRideCategory = {
  code: string; name: string; description: string; capacity: number; luggageNote: string | null; currency: string;
  baseFareMinor: number; perKmMinor: number; perMinuteMinor: number; minimumFareMinor: number; bookingFeeMinor: number;
};

export function useRideCategories() {
  return useQuery({ queryKey: ['ride-categories'], queryFn: () => apiFetch<PublicRideCategory[]>('/ride-categories') });
}
