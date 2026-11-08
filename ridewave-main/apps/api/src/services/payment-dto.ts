import type { PaymentMethodRow, PaymentRow } from '../types/payment';

export const toPaymentDto = (p: PaymentRow) => ({
  id: p.id, rideId: p.rideId, method: p.method, status: p.status, amountMinor: p.amountMinor, currency: p.currency, provider: p.provider,
  isSimulated: p.provider === 'dev', transactionRef: p.transactionRef, failureReason: p.failureReason, description: p.description, createdAt: p.createdAt, updatedAt: p.updatedAt,
});
/** Minimal view for the ride page and the driver (no references or card details). */
export const toPaymentSummary = (p: PaymentRow | undefined) => (p ? { id: p.id, method: p.method, status: p.status, isSimulated: p.provider === 'dev' } : null);
export const toMethodDto = ({ providerToken: _t, ...rest }: PaymentMethodRow) => (void _t, rest);

/** The payment shown for a ride: the one still in flight if any, otherwise the most recent attempt. */
export const currentPayment = (list: PaymentRow[]) => list.find((p) => p.status !== 'FAILED') ?? list[0];
