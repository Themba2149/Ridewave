import { env } from '../config/env';
import { devPaymentProvider } from './dev-payment-provider';

export type ChargeInput = { amountMinor: number; currency: string; method: 'CARD' | 'DIGITAL_WALLET'; token: string; last4: string | null; idempotencyKey: string };
export type ChargeResult = { status: 'SUCCEEDED' | 'FAILED' | 'PENDING'; transactionRef: string; failureReason?: string };

/**
 * What the platform needs from a payment gateway. A real adapter must: use the gateway's hosted checkout or tokenisation (raw card data never
 * touches this server), send the idempotencyKey with every charge, and confirm outcomes from the gateway's signed webhooks, not from the browser.
 */
export interface PaymentProvider {
  readonly id: string;
  /** False for the development adapter: nothing it reports is a real transaction. */
  readonly isLive: boolean;
  createPaymentMethodToken(input: { type: 'CARD' | 'DIGITAL_WALLET'; last4?: string }): Promise<{ token: string }>;
  charge(input: ChargeInput): Promise<ChargeResult>;
  getStatus(transactionRef: string, createdAt: Date): Promise<{ status: 'SUCCEEDED' | 'FAILED' | 'PENDING'; failureReason?: string }>;
}

export function getPaymentProvider(): PaymentProvider {
  if (env.PAYMENT_PROVIDER === 'dev') return devPaymentProvider;
  throw new Error(`PAYMENT_PROVIDER=${env.PAYMENT_PROVIDER} is not implemented. Set PAYMENT_PROVIDER=dev in .env.`);
}
