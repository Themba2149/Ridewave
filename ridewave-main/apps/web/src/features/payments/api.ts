import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api-client';

export type MethodType = 'CASH' | 'CARD' | 'DIGITAL_WALLET';
export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED';
export type Payment = {
  id: string; rideId: string; method: MethodType; status: PaymentStatus; amountMinor: number; currency: string; provider: string; isSimulated: boolean;
  transactionRef: string | null; failureReason: string | null; description: string | null; createdAt: string;
};
export type PaymentMethod = { id: string; type: 'CARD' | 'DIGITAL_WALLET'; label: string; last4: string | null; isDefault: boolean };

export const usePaymentMethods = () => useQuery({ queryKey: ['payment-methods'], queryFn: async () => (await apiFetch<{ items: PaymentMethod[] }>('/passengers/me/payment-methods')).items });

export function useAddPaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { type: 'CARD' | 'DIGITAL_WALLET'; label: string; last4?: string; isDefault?: boolean }) => apiFetch('/passengers/me/payment-methods', { method: 'POST', body: JSON.stringify(v) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payment-methods'] }),
  });
}
export function useRemovePaymentMethod() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => apiFetch(`/passengers/me/payment-methods/${id}`, { method: 'DELETE' }), onSuccess: () => qc.invalidateQueries({ queryKey: ['payment-methods'] }) });
}
export function useDefaultPaymentMethod() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => apiFetch(`/passengers/me/payment-methods/${id}/default`, { method: 'PATCH' }), onSuccess: () => qc.invalidateQueries({ queryKey: ['payment-methods'] }) });
}

export function useCheckout(rideId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { method: MethodType; paymentMethodId?: string }) => apiFetch<{ payment: Payment; duplicate: boolean }>('/payments/checkout', { method: 'POST', body: JSON.stringify({ rideId, ...v }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ride', rideId] }); qc.invalidateQueries({ queryKey: ['receipt', rideId] }); },
  });
}

/** Polls a pending (non-cash) payment until the provider settles it. */
export const usePayment = (id: string | undefined, poll = false) =>
  useQuery({
    queryKey: ['payment', id], enabled: !!id, queryFn: async () => (await apiFetch<{ payment: Payment }>(`/payments/${id}`)).payment,
    refetchInterval: (q) => (poll && q.state.data?.status === 'PENDING' ? 4000 : false),
  });

export function useConfirmCash() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rideId: string) => apiFetch(`/rides/${rideId}/cash-received`, { method: 'POST' }),
    onSettled: () => { qc.invalidateQueries({ queryKey: ['driver-rides'] }); },
  });
}
