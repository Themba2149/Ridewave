import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminNotificationsPage } from '../admin/AdminNotificationsPage';
import { AdminPaymentsPage } from '../admin/AdminPaymentsPage';
import { AdminSettingsPage } from '../admin/AdminSettingsPage';
import { DriverRidesPage } from '../driver/DriverRidesPage';
import { NotificationsPage } from '../notifications/NotificationsPage';
import { ReceiptPage } from '../rides/ReceiptPage';
import { RideDetailPage } from '../rides/RideDetailPage';
import type { RideDetail } from '../rides/types';
import { PaymentMethodsPage, methodSchema } from './PaymentMethodsPage';

type Handler = (init?: RequestInit) => unknown;
function mockApi(handlers: Array<[string, Handler]>) {
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const path = String(url).replace('/api/v1', '');
    const hit = [...handlers].filter(([prefix]) => path.startsWith(prefix)).sort((a, b) => b[0].length - a[0].length)[0];
    if (!hit) return { ok: false, status: 404, json: async () => ({ success: false, error: { code: 'NOT_FOUND', message: `No mock for ${path}` } }) };
    return { ok: true, status: 200, json: async () => ({ success: true, data: hit[1](init) }) };
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}
const calls = (fn: ReturnType<typeof vi.fn>, suffix: string, method: string) => fn.mock.calls.filter(([u, i]) => String(u).includes(suffix) && i?.method === method);
const body = (call: unknown[]) => JSON.parse((call[1] as { body: string }).body);
function renderAt(ui: React.ReactElement, path = '/x', route = '/x') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><Routes><Route path={route} element={ui} /></Routes></MemoryRouter></QueryClientProvider>);
}
afterEach(() => vi.unstubAllGlobals());

const fare = { currency: 'ZAR', baseFareMinor: 1500, distanceChargeMinor: 7500, timeChargeMinor: 18000, demandAdjustmentMinor: 0, bookingFeeMinor: 500, minimumFareTopUpMinor: 0, roundingAdjustmentMinor: 0, totalMinor: 27500, distanceMeters: 10000, durationSeconds: 1200 };
const ride = (over: Partial<RideDetail> = {}): RideDetail => ({
  id: 'r1', status: 'COMPLETED', category: { code: 'ECONOMY', name: 'RideWave Economy' }, pickup: { address: 'Sandton City', lat: -26.1, lng: 28.05 }, dropoff: { address: 'Rosebank', lat: -26.14, lng: 28.04 },
  currency: 'ZAR', distanceMeters: 10000, durationSeconds: 1200, estimatedFareMinor: 27500, finalFareMinor: 27500, fareBreakdown: fare, routeSource: 'dev-sample', requestedAt: new Date().toISOString(),
  assignedAt: null, completedAt: new Date().toISOString(), cancelledAt: null, cancellationReason: null, cancelledBy: null, statusHistory: [],
  driver: { fullName: 'Demo Driver', ratingAverage: 5, ratingCount: 1, vehicle: null }, hasReview: true, cancellationPolicy: { feeMinor: 2000, freeWindowSeconds: 120 },
  passengerFirstName: 'Pat', driverEtaSeconds: null, driverEtaIsEstimate: false, offerExpiresAt: null, payment: null, ...over,
});
const visa = { id: 'pm1', type: 'CARD', label: 'Visa', last4: '4242', isDefault: true };
const wallet = { id: 'pm2', type: 'DIGITAL_WALLET', label: 'My wallet', last4: null, isDefault: false };
const payment = (over: object = {}) => ({ id: 'pay1', rideId: 'r1', method: 'CARD', status: 'SUCCEEDED', amountMinor: 27500, currency: 'ZAR', provider: 'dev', isSimulated: true, transactionRef: 'dev_txn_abc', failureReason: null, description: 'Visa ending 4242 (simulated, no real money moves)', createdAt: new Date().toISOString(), ...over });

describe('paying for a ride', () => {
  it('pays with the default saved method, sending only the method (never an amount), and labels it simulated', async () => {
    let paid = false;
    const fn = mockApi([
      ['/payments/checkout', () => { paid = true; return { payment: payment(), duplicate: false }; }],
      ['/passengers/me/payment-methods', () => ({ items: [visa, wallet] })],
      ['/rides/r1', () => ({ ride: ride({ payment: paid ? { id: 'pay1', method: 'CARD', status: 'SUCCEEDED', isSimulated: true } : null }) })],
      ['/payments/pay1', () => ({ payment: payment() })],
    ]);
    renderAt(<RideDetailPage />, '/passenger/rides/r1', '/passenger/rides/:rideId');
    expect(await screen.findByText('Pay for this ride')).toBeInTheDocument();
    expect(screen.getByText(/payments are simulated/i)).toBeInTheDocument();
    expect(await screen.findByRole('radio', { name: /Visa •••• 4242/ })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: /^Pay / }));
    await waitFor(() => expect(calls(fn, '/payments/checkout', 'POST')).toHaveLength(1));
    expect(body(calls(fn, '/payments/checkout', 'POST')[0]!)).toEqual({ rideId: 'r1', method: 'CARD', paymentMethodId: 'pm1' });
    expect(await screen.findByText(/Paid .* by card/)).toBeInTheDocument();
    expect(screen.getByText(/Simulated: no real money moved/)).toBeInTheDocument();
  });

  it('offers cash, and explains it is paid only when the driver confirms', async () => {
    let chosen = false;
    mockApi([
      ['/payments/checkout', () => { chosen = true; return { payment: payment({ method: 'CASH', status: 'PENDING', provider: 'cash', isSimulated: false }), duplicate: false }; }],
      ['/passengers/me/payment-methods', () => ({ items: [] })],
      ['/rides/r1', () => ({ ride: ride({ payment: chosen ? { id: 'pay1', method: 'CASH', status: 'PENDING', isSimulated: false } : null }) })],
      ['/payments/pay1', () => ({ payment: payment({ method: 'CASH', status: 'PENDING' }) })],
    ]);
    renderAt(<RideDetailPage />, '/passenger/rides/r1', '/passenger/rides/:rideId');
    expect(await screen.findByRole('radio', { name: /Cash/ })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: /^Pay / }));
    expect(await screen.findByText(/marked as paid when the driver confirms/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Pay / })).not.toBeInTheDocument(); // cannot pay twice
  });

  it('shows why a payment failed and lets the passenger try again', async () => {
    mockApi([
      ['/passengers/me/payment-methods', () => ({ items: [visa] })],
      ['/rides/r1', () => ({ ride: ride({ payment: { id: 'pay1', method: 'CARD', status: 'FAILED', isSimulated: true } }) })],
      ['/payments/pay1', () => ({ payment: payment({ status: 'FAILED', failureReason: 'The card was declined (simulated).' }) })],
    ]);
    renderAt(<RideDetailPage />, '/passenger/rides/r1', '/passenger/rides/:rideId');
    expect(await screen.findByText(/The card was declined \(simulated\)/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Pay / })).toBeInTheDocument();
  });

  it('shows payment details on the receipt, flagged as simulated', async () => {
    mockApi([['/rides/r1/receipt', () => ({ receiptNumber: 'RW-ABC12345', issuedAt: new Date().toISOString(), totalMinor: 27500, ride: ride(), payment: payment() })]]);
    renderAt(<ReceiptPage />, '/passenger/rides/r1/receipt', '/passenger/rides/:rideId/receipt');
    expect(await screen.findByText('RW-ABC12345', { exact: false })).toBeInTheDocument();
    expect(screen.getByText(/Simulated: no real money moved/)).toBeInTheDocument();
    expect(screen.getByText('Paid')).toBeInTheDocument();
    expect(screen.getByText('dev_txn_abc')).toBeInTheDocument();
  });
});

describe('payment methods page', () => {
  it('only accepts the last 4 digits of a card: a full number is refused before anything is sent', async () => {
    expect(methodSchema.safeParse({ type: 'CARD', label: 'Visa', last4: '4242424242424242' }).success).toBe(false);
    expect(methodSchema.safeParse({ type: 'CARD', label: 'Visa', last4: '42' }).success).toBe(false);
    expect(methodSchema.safeParse({ type: 'CARD', label: 'Visa', last4: '4242' }).success).toBe(true);
    expect(methodSchema.safeParse({ type: 'DIGITAL_WALLET', label: 'Wallet' }).success).toBe(true);
    const fn = mockApi([['/passengers/me/payment-methods', () => ({ items: [] })]]);
    renderAt(<PaymentMethodsPage />);
    await screen.findByText(/No saved methods yet/);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Visa' } });
    fireEvent.change(screen.getByLabelText(/Last 4 digits/), { target: { value: '4242' } });
    expect(screen.getByLabelText(/Last 4 digits/)).toHaveAttribute('maxlength', '4');
    fireEvent.change(screen.getByLabelText(/Last 4 digits/), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save method' }));
    expect(await screen.findByText(/Enter only the last 4 digits/)).toBeInTheDocument();
    expect(calls(fn, '/payment-methods', 'POST')).toHaveLength(0);
  });

  it('saves a card with only type, name and last 4, and confirms before deleting', async () => {
    const fn = mockApi([['/passengers/me/payment-methods', (init) => (init?.method === 'POST' ? { method: visa } : { items: [visa] })]]);
    renderAt(<PaymentMethodsPage />);
    expect((await screen.findAllByText(/Visa/)).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Work card' } });
    fireEvent.change(screen.getByLabelText(/Last 4 digits/), { target: { value: '1111' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save method' }));
    await waitFor(() => expect(calls(fn, '/payment-methods', 'POST')).toHaveLength(1));
    expect(body(calls(fn, '/payment-methods', 'POST')[0]!)).toEqual({ type: 'CARD', label: 'Work card', last4: '1111' });

    fireEvent.click(screen.getByRole('button', { name: 'Delete Visa' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete this payment method?', hidden: true });
    expect(calls(fn, '/payment-methods/pm1', 'DELETE')).toHaveLength(0);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(calls(fn, '/payment-methods/pm1', 'DELETE')).toHaveLength(1));
  });
});

describe('driver cash confirmation', () => {
  const trip = (payment: object | null) => ({ items: [{ id: 'r1', status: 'COMPLETED', categoryName: 'RideWave Economy', pickupAddress: 'Sandton', dropoffAddress: 'Rosebank', currency: 'ZAR', estimatedFareMinor: 27500, finalFareMinor: 27500, requestedAt: new Date().toISOString(), completedAt: new Date().toISOString(), payment }], page: 1, pageSize: 10, total: 1 });

  it('lets the driver confirm cash only after an explicit confirmation', async () => {
    const fn = mockApi([['/rides/r1/cash-received', () => ({ payment: {} })], ['/drivers/me/rides', () => trip({ method: 'CASH', status: 'PENDING' })]]);
    renderAt(<DriverRidesPage />);
    fireEvent.click(await screen.findByRole('button', { name: /Confirm cash received/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Confirm cash received?', hidden: true });
    expect(calls(fn, '/cash-received', 'POST')).toHaveLength(0);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Yes, I received the cash' }));
    await waitFor(() => expect(calls(fn, '/rides/r1/cash-received', 'POST')).toHaveLength(1));
  });

  it('shows no confirm button for card payments or already-paid cash', async () => {
    mockApi([['/drivers/me/rides', () => trip({ method: 'CARD', status: 'SUCCEEDED' })]]);
    renderAt(<DriverRidesPage />);
    expect(await screen.findByText(/Payment: card · paid/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Confirm cash received/ })).not.toBeInTheDocument();
  });
});

describe('notifications page', () => {
  const list = (unread: number) => ({ items: [
    { id: 'n1', type: 'RIDE_STATUS', title: 'Your driver is on the way', body: 'Demo Driver accepted your ride.', readAt: null, createdAt: new Date().toISOString() },
    { id: 'n2', type: 'PAYMENT', title: 'Payment received (simulated)', body: 'R275.00 for your ride.', readAt: new Date().toISOString(), createdAt: new Date().toISOString() },
  ], total: 2, unread, page: 1, pageSize: 15 });

  it('shows unread items, marks one or all as read, and says nothing is emailed', async () => {
    const fn = mockApi([['/notifications/n1/read', () => ({ read: true })], ['/notifications/read-all', () => ({ updated: 1 })], ['/notifications', () => list(1)]]);
    renderAt(<NotificationsPage />);
    expect(await screen.findByText('Your driver is on the way')).toBeInTheDocument();
    expect(screen.getByText(/No emails or text messages are sent/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Mark as read/ })).toHaveLength(1); // the read one has no button
    fireEvent.click(screen.getByRole('button', { name: /Mark as read/ }));
    await waitFor(() => expect(calls(fn, '/notifications/n1/read', 'POST')).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: 'Mark all as read' }));
    await waitFor(() => expect(calls(fn, '/notifications/read-all', 'POST')).toHaveLength(1));
  });

  it('can filter to unread only', async () => {
    const fn = mockApi([['/notifications', () => list(1)]]);
    renderAt(<NotificationsPage />);
    await screen.findByText('Your driver is on the way');
    fireEvent.click(screen.getByRole('button', { name: 'Show unread only' }));
    await waitFor(() => expect(fn.mock.calls.some(([u]) => /unread=true/.test(String(u)))).toBe(true));
  });
});

describe('admin: payments, settings and announcements', () => {
  it('lists payments with simulated totals and the honesty note', async () => {
    mockApi([['/admin/payments', () => ({ items: [{ id: 'p1', rideId: 'r1', passengerName: 'Pat', method: 'CARD', status: 'FAILED', amountMinor: 27500, provider: 'dev', transactionRef: 'dev_fail_1', failureReason: 'The card was declined (simulated).', createdAt: new Date().toISOString() }], total: 1, page: 1, pageSize: 10,
      summary: { succeededMinor: 55000, pendingMinor: 0, counts: { FAILED: 1, SUCCEEDED: 2 } }, note: 'Payments in this build use a simulated provider. No real money has moved.' })]]);
    renderAt(<AdminPaymentsPage />);
    expect(await screen.findByText(/succeeded: 2/)).toBeInTheDocument();
    expect(screen.getByText(/No real money has moved/)).toBeInTheDocument();
    expect(screen.getAllByText('Simulated').length).toBeGreaterThan(0);
    expect(screen.getByText('The card was declined (simulated).')).toBeInTheDocument();
  });

  it('converts commission percent to basis points and sends only what changed', async () => {
    const settings = { values: { driverCommissionBp: 2000, offerTtlSeconds: 60, searchTimeoutSeconds: 60, maxPickupRadiusMeters: 15000 }, overridden: [] };
    const fn = mockApi([['/admin/settings', () => settings]]);
    renderAt(<AdminSettingsPage />);
    const commission = await screen.findByLabelText(/Driver commission/);
    expect(commission).toHaveValue('20.00');
    expect(screen.getAllByText('Default').length).toBe(4);
    fireEvent.change(commission, { target: { value: '12.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    await waitFor(() => expect(calls(fn, '/admin/settings', 'PATCH')).toHaveLength(1));
    expect(body(calls(fn, '/admin/settings', 'PATCH')[0]!)).toEqual({ driverCommissionBp: 1250 });
  });

  it('rejects out-of-range settings on the page without calling the server', async () => {
    const fn = mockApi([['/admin/settings', () => ({ values: { driverCommissionBp: 2000, offerTtlSeconds: 60, searchTimeoutSeconds: 60, maxPickupRadiusMeters: 15000 }, overridden: ['offerTtlSeconds'] })]]);
    renderAt(<AdminSettingsPage />);
    fireEvent.change(await screen.findByLabelText(/Driver commission/), { target: { value: '80' } });
    fireEvent.change(screen.getByLabelText(/Driver response time/), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(await screen.findByText(/percentage from 0 to 50/)).toBeInTheDocument();
    expect(screen.getByText(/whole number from 10 to 300/)).toBeInTheDocument();
    expect(calls(fn, '/admin/settings', 'PATCH')).toHaveLength(0);
    expect(screen.getByText('Set by an administrator')).toBeInTheDocument();
  });

  it('asks for confirmation before sending an announcement, then reports how many received it', async () => {
    const fn = mockApi([['/admin/notifications', () => ({ sent: 3 })]]);
    renderAt(<AdminNotificationsPage />);
    fireEvent.change(await screen.findByLabelText('Send to'), { target: { value: 'PASSENGER' } });
    fireEvent.click(screen.getByRole('button', { name: 'Review and send' }));
    expect(await screen.findByText(/title must be 3 to 80 characters/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Weekend promo' } });
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Demonstration announcement' } });
    fireEvent.click(screen.getByRole('button', { name: 'Review and send' }));
    const dialog = await screen.findByRole('dialog', { name: 'Send this announcement?', hidden: true });
    expect(calls(fn, '/admin/notifications', 'POST')).toHaveLength(0);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send now' }));
    await waitFor(() => expect(calls(fn, '/admin/notifications', 'POST')).toHaveLength(1));
    expect(body(calls(fn, '/admin/notifications', 'POST')[0]!)).toEqual({ audience: 'PASSENGER', title: 'Weekend promo', body: 'Demonstration announcement' });
    expect(await screen.findByText('Sent to 3 people.')).toBeInTheDocument();
  });
});
