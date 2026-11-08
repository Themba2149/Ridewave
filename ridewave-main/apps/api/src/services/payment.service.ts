import { getPaymentProvider } from '../providers/payment-provider';
import { paymentsRepository as repo } from '../repositories/payments.repository';
import { ridesRepository as rides } from '../repositories/rides.repository';
import type { UserRecord } from '../types/auth';
import type { PaymentMethodType, PaymentRow } from '../types/payment';
import { AppError } from '../utils/errors';
import { notify } from './notifications.service';
import { emitToUser } from './realtime.service';
import { toMethodDto, toPaymentDto, toPaymentSummary } from './payment-dto';
import { getRideForUser } from './ride.service';

const rand = (minor: number) => `R${(minor / 100).toFixed(2)}`;
const IN_FLIGHT = ['PENDING', 'PROCESSING', 'SUCCEEDED', 'REFUNDED'] as const; // anything but FAILED blocks a second payment for the ride

async function notifyOutcome(p: PaymentRow) {
  const sim = p.provider === 'dev' ? ' (simulated)' : '';
  if (p.status === 'SUCCEEDED') await notify(p.passengerUserId, { type: 'PAYMENT', title: `Payment received${sim}`, body: `${rand(p.amountMinor)} for your ride.` });
  else if (p.status === 'FAILED') await notify(p.passengerUserId, { type: 'PAYMENT', title: 'Payment failed', body: `${p.failureReason ?? 'The payment did not go through.'} You can try again.` });
  else if (p.status === 'PENDING' && p.method !== 'CASH') await notify(p.passengerUserId, { type: 'PAYMENT', title: `Payment processing${sim}`, body: 'We will let you know when it completes.' });
  emitToUser(p.passengerUserId, 'payment:updated', { paymentId: p.id, rideId: p.rideId, status: p.status });
}

export async function checkout(user: UserRecord, input: { rideId: string; method: PaymentMethodType; paymentMethodId?: string }) {
  const ride = await getRideForUser(user, input.rideId);
  if (ride.passengerUserId !== user.id) throw AppError.forbidden('Only the passenger can pay for this ride.');
  if (ride.status !== 'COMPLETED' || !ride.finalFareMinor || ride.finalFareMinor <= 0) throw AppError.invalidState('You can pay once the ride is completed.');

  const existing = await repo.findByRide(input.rideId);
  const active = existing.find((p) => (IN_FLIGHT as readonly string[]).includes(p.status));
  if (active) return { payment: toPaymentDto(active), duplicate: true }; // replayed or double-clicked request: never charge twice

  const pid = await rides.getPassengerProfileId(user.id);
  if (!pid) throw AppError.forbidden('Only passengers can pay.');
  // The unique key is per ride and attempt number, so two simultaneous first attempts collide in the database instead of both charging.
  const idempotencyKey = `${input.rideId}:${existing.length + 1}`;
  const amountMinor = ride.finalFareMinor;
  const currency = ride.currency;

  try {
    if (input.method === 'CASH') {
      const payment = await repo.create({ rideId: input.rideId, method: 'CASH', status: 'PENDING', amountMinor, currency, provider: 'cash', idempotencyKey, description: 'Cash: pay your driver directly. Marked paid when the driver confirms.' });
      if (ride.driverUserId) await notify(ride.driverUserId, { type: 'PAYMENT', title: 'Passenger will pay cash', body: `Confirm once you have received ${rand(amountMinor)}.` });
      await notifyOutcome(payment);
      return { payment: toPaymentDto(payment), duplicate: false };
    }

    const method = input.paymentMethodId ? await repo.getMethod(pid, input.paymentMethodId) : null; // owner-scoped lookup
    if (!method || method.type !== input.method) throw AppError.validation('Choose one of your saved payment methods.');
    const provider = getPaymentProvider();
    const description = `${method.label}${method.last4 ? ` ending ${method.last4}` : ''}${provider.isLive ? '' : ' (simulated, no real money moves)'}`;
    const started = await repo.create({ rideId: input.rideId, method: input.method, status: 'PROCESSING', amountMinor, currency, provider: provider.id, idempotencyKey, description });
    try {
      const result = await provider.charge({ amountMinor, currency, method: input.method, token: method.providerToken ?? '', last4: method.last4, idempotencyKey });
      const done = await repo.update(started.id, { status: result.status, transactionRef: result.transactionRef, failureReason: result.failureReason ?? null }, { type: `CHARGE_${result.status}`, detail: result.failureReason });
      await notifyOutcome(done);
      return { payment: toPaymentDto(done), duplicate: false };
    } catch {
      const failed = await repo.update(started.id, { status: 'FAILED', failureReason: 'The payment provider could not be reached.' }, { type: 'CHARGE_ERROR' });
      await notifyOutcome(failed);
      return { payment: toPaymentDto(failed), duplicate: false };
    }
  } catch (e) {
    if (e instanceof AppError && e.status === 409) { // lost a race with a simultaneous request: report the winner
      const winner = (await repo.findByRide(input.rideId)).find((p) => (IN_FLIGHT as readonly string[]).includes(p.status));
      if (winner) return { payment: toPaymentDto(winner), duplicate: true };
    }
    throw e;
  }
}

/** Participants and administrators only. A pending simulated payment is settled lazily here (polling). */
export async function getPayment(user: UserRecord, paymentId: string) {
  let p = await repo.getById(paymentId);
  const allowed = p && (user.role === 'ADMIN' || p.passengerUserId === user.id || p.driverUserId === user.id);
  if (!p || !allowed) throw AppError.notFound('Payment not found.');
  if (p.status === 'PENDING' && p.method !== 'CASH' && p.transactionRef) {
    const provider = getPaymentProvider();
    const latest = await provider.getStatus(p.transactionRef, p.createdAt);
    if (latest.status !== 'PENDING') {
      p = await repo.update(p.id, { status: latest.status, failureReason: latest.failureReason ?? null }, { type: `SETTLED_${latest.status}`, detail: 'Confirmed by the payment provider' });
      await notifyOutcome(p);
    }
  }
  return user.id === p.driverUserId ? toPaymentSummary(p) : toPaymentDto(p);
}

/** The driver confirms they received the cash. Only then is a cash payment marked as paid. */
export async function confirmCash(user: UserRecord, rideId: string) {
  const ride = await getRideForUser(user, rideId);
  if (ride.driverUserId !== user.id) throw AppError.forbidden('Only the driver of this ride can confirm cash.');
  const cash = (await repo.findByRide(rideId)).find((p) => p.method === 'CASH' && p.status === 'PENDING');
  if (!cash) throw AppError.invalidState('The passenger has not chosen to pay cash for this ride, or it is already settled.');
  const done = await repo.update(cash.id, { status: 'SUCCEEDED' }, { type: 'CASH_CONFIRMED', detail: 'Confirmed by the driver' });
  await notifyOutcome(done);
  return toPaymentSummary(done);
}

// ---- saved payment methods (tokens and last four digits only; never full card numbers or CVV) ----
async function profileId(user: UserRecord) {
  const id = await rides.getPassengerProfileId(user.id);
  if (!id) throw AppError.forbidden('Only passengers can manage payment methods.');
  return id;
}
export async function listMethods(user: UserRecord) { return (await repo.listMethods(await profileId(user))).map(toMethodDto); }
export async function addMethod(user: UserRecord, input: { type: 'CARD' | 'DIGITAL_WALLET'; label: string; last4?: string; isDefault?: boolean }) {
  const pid = await profileId(user);
  if ((await repo.listMethods(pid)).length >= 10) throw AppError.conflict('You can save up to 10 payment methods.');
  const { token } = await getPaymentProvider().createPaymentMethodToken({ type: input.type, last4: input.last4 });
  return toMethodDto(await repo.createMethod(pid, { type: input.type, label: input.label, last4: input.type === 'CARD' ? input.last4 ?? null : null, providerToken: token, isDefault: !!input.isDefault }));
}
export async function removeMethod(user: UserRecord, id: string) { if (!(await repo.deleteMethod(await profileId(user), id))) throw AppError.notFound('Payment method not found.'); }
export async function makeDefaultMethod(user: UserRecord, id: string) { if (!(await repo.setDefaultMethod(await profileId(user), id))) throw AppError.notFound('Payment method not found.'); }
