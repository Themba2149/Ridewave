import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FareBreakdownTable } from '../../components/booking/FareBreakdownTable';
import { BookRidePage } from './BookRidePage';
import { RideDetailPage } from './RideDetailPage';
import type { FareBreakdown, RideDetail } from './types';

const fare: FareBreakdown = { currency: 'ZAR', baseFareMinor: 1500, distanceChargeMinor: 7500, timeChargeMinor: 18000, demandAdjustmentMinor: 0, bookingFeeMinor: 500, minimumFareTopUpMinor: 0, roundingAdjustmentMinor: 0, totalMinor: 27500, distanceMeters: 10000, durationSeconds: 1200 };
const places = [
  { id: 'sandton-city', name: 'Sandton City', address: 'Sandton City, Rivonia Rd, Sandton', lat: -26.1076, lng: 28.0567 },
  { id: 'or-tambo', name: 'OR Tambo International Airport', address: 'OR Tambo International Airport, Kempton Park', lat: -26.1337, lng: 28.242 },
];
const estimate = { isEstimate: true, route: { distanceMeters: 10000, durationSeconds: 1200, source: 'dev-sample', isLive: false }, options: [
  { code: 'ECONOMY', name: 'RideWave Economy', description: 'd', capacity: 4, luggageNote: null, fare },
  { code: 'COMFORT', name: 'RideWave Comfort', description: 'd', capacity: 4, luggageNote: null, fare: { ...fare, totalMinor: 32000 } },
] };
const ride = (over: Partial<RideDetail> = {}): RideDetail => ({
  id: 'r1', status: 'SEARCHING_FOR_DRIVER', category: { code: 'ECONOMY', name: 'RideWave Economy' }, pickup: places[0]!, dropoff: places[1]!,
  currency: 'ZAR', distanceMeters: 10000, durationSeconds: 1200, estimatedFareMinor: 27500, finalFareMinor: null, fareBreakdown: fare, routeSource: 'dev-sample',
  requestedAt: new Date().toISOString(), assignedAt: null, completedAt: null, cancelledAt: null, cancellationReason: null, cancelledBy: null,
  statusHistory: [{ fromStatus: null, toStatus: 'REQUESTED', actorType: 'PASSENGER', note: null, createdAt: new Date().toISOString() }],
  driver: null, hasReview: false, cancellationPolicy: { feeMinor: 2000, freeWindowSeconds: 120 },
  passengerFirstName: 'Pat', driverEtaSeconds: null, driverEtaIsEstimate: false, offerExpiresAt: null, payment: null, ...over,
});

type Handler = (init?: RequestInit) => unknown;
function mockApi(handlers: Array<[string, Handler]>) {
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const path = String(url).replace('/api/v1', '');
    const hit = handlers.find(([prefix]) => path.startsWith(prefix));
    if (!hit) return { ok: false, status: 404, json: async () => ({ success: false, error: { code: 'NOT_FOUND', message: `No mock for ${path}` } }) };
    return { ok: true, status: 200, json: async () => ({ success: true, data: hit[1](init) }) };
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}
function renderAt(path: string, element: React.ReactElement, routePath: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={routePath} element={element} />
          <Route path="/passenger/rides/:rideId" element={<p>Ride page opened</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
afterEach(() => vi.unstubAllGlobals());

describe('FareBreakdownTable', () => {
  it('itemises the fare and labels estimate vs final', () => {
    const { rerender } = render(<FareBreakdownTable fare={fare} />);
    expect(screen.getByText('Estimated total')).toBeInTheDocument();
    expect(screen.getByText('Booking fee')).toBeInTheDocument();
    expect(screen.queryByText('Demand adjustment')).not.toBeInTheDocument();
    rerender(<FareBreakdownTable fare={{ ...fare, demandAdjustmentMinor: 500, minimumFareTopUpMinor: 100, roundingAdjustmentMinor: 50 }} final />);
    expect(screen.getByText('Total fare')).toBeInTheDocument();
    expect(screen.getByText('Demand adjustment')).toBeInTheDocument();
    expect(screen.getByText('Minimum fare adjustment')).toBeInTheDocument();
    expect(screen.getByText('Rounding')).toBeInTheDocument();
  });
});

describe('BookRidePage', () => {
  it('walks pickup → destination → category → confirm and sends no fare to the server', async () => {
    const fetchMock = mockApi([
      ['/passengers/me/rides', () => ({ items: [], page: 1, pageSize: 1, total: 0 })],
      ['/passengers/me/saved-locations', () => ({ items: [] })],
      ['/places/search', () => ({ places, provider: { id: 'dev-sample', isLive: false } })],
      ['/rides/estimate', () => estimate],
      ['/rides', () => ({ ride: ride(), duplicate: false })],
    ]);
    renderAt('/passenger/book', <BookRidePage />, '/passenger/book');

    fireEvent.change(await screen.findByLabelText('Pickup location'), { target: { value: 'sandton' } });
    fireEvent.mouseDown(await screen.findByRole('option', { name: /Sandton City/ }));
    fireEvent.change(await screen.findByLabelText('Destination'), { target: { value: 'tambo' } });
    fireEvent.mouseDown(await screen.findByRole('option', { name: /OR Tambo/ }));
    fireEvent.click(screen.getByRole('button', { name: 'See ride options' }));

    expect(await screen.findByText(/development estimate \(not a live route/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: /RideWave Comfort/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText(/This is an estimate/)).toBeInTheDocument();
    expect(screen.getByText(/Development map: a schematic/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm booking' }));
    expect(await screen.findByText('Ride page opened')).toBeInTheDocument();

    const post = fetchMock.mock.calls.find(([u, i]) => String(u).endsWith('/rides') && i?.method === 'POST')!;
    const body = JSON.parse(post[1]!.body as string);
    expect(body.categoryCode).toBe('COMFORT');
    expect(body.idempotencyKey).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    expect(Object.keys(body).sort()).toEqual(['categoryCode', 'dropoff', 'idempotencyKey', 'pickup']);
  });

  it('asks for both locations before calling the estimate API', async () => {
    const fetchMock = mockApi([
      ['/passengers/me/rides', () => ({ items: [], page: 1, pageSize: 1, total: 0 })],
      ['/passengers/me/saved-locations', () => ({ items: [] })],
      ['/places/search', () => ({ places, provider: { id: 'dev-sample', isLive: false } })],
    ]);
    renderAt('/passenger/book', <BookRidePage />, '/passenger/book');
    fireEvent.click(await screen.findByRole('button', { name: 'See ride options' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/both a pickup location and a destination/);
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/rides/estimate'))).toBe(false);
  });

  it('stops the flow and links to the current ride when one is already active', async () => {
    mockApi([
      ['/passengers/me/rides', () => ({ items: [{ id: 'r9', status: 'SEARCHING_FOR_DRIVER' }], page: 1, pageSize: 1, total: 1 })],
      ['/passengers/me/saved-locations', () => ({ items: [] })],
    ]);
    renderAt('/passenger/book', <BookRidePage />, '/passenger/book');
    expect(await screen.findByText(/already have an active ride/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'See ride options' })).not.toBeInTheDocument();
  });
});

describe('RideDetailPage', () => {
  it('shows the searching state honestly and cancels only after confirmation', async () => {
    const fetchMock = mockApi([
      ['/rides/r1/cancel', () => ({ ride: ride({ status: 'CANCELLED', cancelledBy: 'PASSENGER' }), cancellationFeeMinor: 0 })],
      ['/rides/r1', () => ({ ride: ride() })],
    ]);
    renderAt('/passenger/rides/r1', <RideDetailPage />, '/passenger/rides/:rideId');
    expect(await screen.findByText(/looking for an available driver nearby/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel ride' }));
    const dialog = await screen.findByRole('dialog', { hidden: true });
    expect(within(dialog).getByText(/no charge for cancelling now/)).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/cancel'))).toBe(false); // nothing sent yet

    fireEvent.click(within(dialog).getByRole('button', { name: 'Yes, cancel ride' }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([u, i]) => String(u).includes('/cancel') && i?.method === 'POST')).toBe(true));
    expect(await screen.findByText(/This ride was cancelled by the passenger/)).toBeInTheDocument();
  });

  it('explains the cancellation fee once a driver is assigned', async () => {
    mockApi([['/rides/r1', () => ({ ride: ride({ status: 'DRIVER_ARRIVING', assignedAt: new Date().toISOString(), driverEtaSeconds: 420, driverEtaIsEstimate: true, driver: { fullName: 'Demo Driver', ratingAverage: 4.8, ratingCount: 12, vehicle: { make: 'Toyota', model: 'Etios', colour: 'White', registration: 'DEMO001GP' } } }) })]]);
    renderAt('/passenger/rides/r1', <RideDetailPage />, '/passenger/rides/:rideId');
    expect(await screen.findByText('Demo Driver')).toBeInTheDocument();
    expect(screen.getByText('DEMO001GP')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel ride' }));
    expect(await screen.findByText(/cancellation fee of .*20.* applies/)).toBeInTheDocument();
  });

  it('offers a receipt and a review form for completed rides, and no cancel button', async () => {
    mockApi([['/rides/r1', () => ({ ride: ride({ status: 'COMPLETED', finalFareMinor: 27500, driver: { fullName: 'Demo Driver', ratingAverage: 5, ratingCount: 1, vehicle: null } }) })]]);
    renderAt('/passenger/rides/r1', <RideDetailPage />, '/passenger/rides/:rideId');
    expect(await screen.findByRole('link', { name: 'View receipt' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit review' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel ride' })).not.toBeInTheDocument();
  });
});
