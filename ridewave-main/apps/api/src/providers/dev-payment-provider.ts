import crypto from 'node:crypto';
import type { ChargeInput, ChargeResult, PaymentProvider } from './payment-provider';

/**
 * DEVELOPMENT PAYMENT ADAPTER. It moves no money and contacts no payment network. Outcomes are deterministic so they can be tested:
 *   card ending 0002 -> declined (FAILED)
 *   card ending 0005 -> PENDING, settles to SUCCEEDED about 15 seconds later
 *   anything else    -> SUCCEEDED
 * Every reference it returns starts with "dev_" so it can never be mistaken for a real transaction id.
 */
export const DEV_PENDING_MS = 15_000;
const digest = (key: string) => crypto.createHash('sha256').update(key).digest('hex').slice(0, 16);

export const devPaymentProvider: PaymentProvider = {
  id: 'dev',
  isLive: false,
  async createPaymentMethodToken() { return { token: `dev_tok_${crypto.randomBytes(8).toString('hex')}` }; },
  async charge(i: ChargeInput): Promise<ChargeResult> {
    const h = digest(i.idempotencyKey); // same key -> same reference: a replayed charge cannot create a second transaction
    if (i.last4 === '0002') return { status: 'FAILED', transactionRef: `dev_fail_${h}`, failureReason: 'The card was declined (simulated).' };
    if (i.last4 === '0005') return { status: 'PENDING', transactionRef: `dev_pend_${h}` };
    return { status: 'SUCCEEDED', transactionRef: `dev_txn_${h}` };
  },
  async getStatus(ref, createdAt) {
    if (ref.startsWith('dev_txn_')) return { status: 'SUCCEEDED' };
    if (ref.startsWith('dev_pend_')) return Date.now() - createdAt.getTime() >= DEV_PENDING_MS ? { status: 'SUCCEEDED' } : { status: 'PENDING' };
    return { status: 'FAILED', failureReason: 'The card was declined (simulated).' };
  },
};
