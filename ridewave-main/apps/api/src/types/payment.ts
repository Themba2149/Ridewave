export type PaymentMethodType = 'CASH' | 'CARD' | 'DIGITAL_WALLET';
export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED';

export type PaymentRow = {
  id: string; rideId: string; method: PaymentMethodType; status: PaymentStatus; amountMinor: number; currency: string; provider: string;
  transactionRef: string | null; failureReason: string | null; description: string | null; createdAt: Date; updatedAt: Date;
  passengerUserId: string; driverUserId: string | null;
};
export type PaymentMethodRow = { id: string; type: Exclude<PaymentMethodType, 'CASH'>; label: string; last4: string | null; providerToken: string | null; isDefault: boolean; createdAt: Date };
export type AdminPaymentRow = {
  id: string; rideId: string; passengerName: string; method: PaymentMethodType; status: PaymentStatus; amountMinor: number; currency: string;
  provider: string; transactionRef: string | null; failureReason: string | null; createdAt: Date;
};
export type PaymentSummary = { succeededMinor: number; pendingMinor: number; counts: Record<string, number> };
