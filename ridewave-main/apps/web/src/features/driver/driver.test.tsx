import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RideDetailPage } from '../rides/RideDetailPage';
import type { RideDetail } from '../rides/types';
import { DriverEarningsPage } from './DriverEarningsPage';
import { DriverHome } from './DriverHome';

const places = [{ id: 'sandton-city', name: 'Sandton City', address: 'Sandton City, Rivonia Rd, Sandton', lat: -26.1076, lng: 28.0567 }, { id: 'rosebank-mall', name: 'The Zone @ Rosebank', address: 'Rosebank', lat: -26.145, lng: 28.0408 }];
const profile = (over: object = {}) => ({ profile: { approvalStatus: 'APPROVED', isOnline: false, ratingAverage: 4.8, ratingCount: 5, location: null, vehicles: [{ id: 'v1', make: 'Toyota', model: 'Etios', year: 2019, registration: 'DEMO001GP' }], ...over } });
const earnings = { period: 'day', trips: 2, grossMinor: 55000, commissionMinor: 11000, netMinor: 44000, commission: { rateBp: 2000, isDemonstrationRate: true }, daily: [{ date: '2026-10-14', trips: 1, grossMinor: 27500, netMinor: 22000 }, { date: '2026-10-15', trips: 1, grossMinor: 27500, netMinor: 22000 }], stats: { completedTripsAllTime: 9, offersAccepted: 3, offersDeclined: 1, acceptanceRatePercent: 75 } };
const offer = { rideId: 'r1', passengerFirstName: 'Pat', category: 'RideWave Economy', pickup: { address: 'Sandton City, Rivonia Rd, Sandton', lat: -26.1076, lng: 28.0567 }, dropoff: { address: 'OR Tambo International Airport', lat: -26.1337, lng: 28.242 }, distanceMeters: 21000, durationSeconds: 2500, estimatedFareMinor: 27500, estimatedEarningsMinor: 22000, pickupEtaSeconds: 300, offerExpiresAt: new Date(Date.now() + 45_000).toISOString() };
const ride = (over: Partial<RideDetail> = {}): RideDetail => ({
  id: 'r1', status: 'DRIVER_ARRIVED', category: { code: 'ECONOMY', name: 'RideWave Economy' }, pickup: offer.pickup, dropoff: offer.dropoff, currency: 'ZAR', distanceMeters: 21000, durationSeconds: 2500,
  estimatedFareMinor: 27500, finalFareMinor: null, fareBreakdown: null, routeSource: 'dev-sample', requestedAt: new Date().toISOString(), assignedAt: null, completedAt: null, cancelledAt: null, cancellationReason: null, cancelledBy: null,
  statusHistory: [], driver: null, hasReview: false, cancellationPolicy: { feeMinor: 2000, freeWindowSeconds: 120 }, passengerFirstName: 'Pat', driverEtaSeconds: null, driverEtaIsEstimate: false, offerExpiresAt: null, payment: null, ...over,
});

type Handler = (init?: RequestInit) => unknown;
function mockApi(handlers: Array<[string, Handler]>) {
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const path = String(url).replace('/api/v1', '');
    const hit = [...handlers].filter(([prefix]) => path.startsWith(prefix)).sort((a, b) => b[0].length - a[0].length)[0]; // most specific prefix wins
    if (!hit) return { ok: false, status: 404, json: async () => ({ success: false, error: { code: 'NOT_FOUND', message: `No mock for ${path}` } }) };
    return { ok: true, status: 200, json: async () => ({ success: true, data: hit[1](init) }) };
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}
const posted = (fn: ReturnType<typeof vi.fn>, suffix: string, method = 'POST') => fn.mock.calls.filter(([u, i]) => String(u).endsWith(suffix) && i?.method === method);
function renderIt(ui: React.ReactElement, path = '/x', route = '/x') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><Routes><Route path={route} element={ui} /></Routes></MemoryRouter></QueryClientProvider>);
}
const base = (over: Array<[string, Handler]> = []): Array<[string, Handler]> => [
  ...over,
  ['/drivers/me/earnings', () => earnings], ['/drivers/me/ride-requests', () => ({ items: [] })],
  ['/drivers/me/rides', () => ({ items: [], page: 1, pageSize: 5, total: 0 })], ['/drivers/me/availability', () => ({ isOnline: true })],
  ['/places/search', () => ({ places, provider: { id: 'dev-sample', isLive: false } })], ['/drivers/me', () => profile()],
];
afterEach(() => vi.unstubAllGlobals());

describe('DriverHome availability', () => {
  it('asks for a location, then goes online with the chosen coordinates', async () => {
    const fn = mockApi(base());
    renderIt(<DriverHome />);
    fireEvent.click(await screen.findByRole('button', { name: 'Go online' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Choose your current location first.');
    expect(posted(fn, '/drivers/me/availability', 'PATCH')).toHaveLength(0);

    await screen.findByRole('option', { name: 'Sandton City' });
    fireEvent.change(screen.getByLabelText(/Your location/), { target: { value: 'sandton-city' } });
    fireEvent.click(screen.getByRole('button', { name: 'Go online' }));
    await waitFor(() => expect(posted(fn, '/drivers/me/availability', 'PATCH')).toHaveLength(1));
    expect(JSON.parse(posted(fn, '/drivers/me/availability', 'PATCH')[0]![1].body)).toEqual({ isOnline: true, lat: -26.1076, lng: 28.0567 });
  });

  it('keeps unapproved drivers offline and explains why', async () => {
    mockApi(base([['/drivers/me', () => profile({ approvalStatus: 'PENDING' })]]));
    renderIt(<DriverHome />);
    expect(await screen.findByText(/must be approved before you can go online/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Go online' })).not.toBeInTheDocument();
  });

  it('sends drivers without a vehicle to the vehicle page', async () => {
    mockApi(base([['/drivers/me', () => profile({ vehicles: [] })]]));
    renderIt(<DriverHome />);
    expect(await screen.findByRole('link', { name: 'Add a vehicle' })).toHaveAttribute('href', '/driver/vehicle');
    expect(screen.queryByRole('button', { name: 'Go online' })).not.toBeInTheDocument();
  });
});

describe('DriverHome requests and trips', () => {
  it('shows an incoming request with the driver’s share and accepts it', async () => {
    const fn = mockApi(base([['/drivers/me/ride-requests', () => ({ items: [offer] })], ['/rides/r1/accept', () => ({ ride: ride() })], ['/drivers/me', () => profile({ isOnline: true })]]));
    renderIt(<DriverHome />);
    expect(await screen.findByText('New ride request')).toBeInTheDocument();
    expect(screen.getByText(/Respond within \d+s/)).toBeInTheDocument();
    expect(screen.getByText(/your share about/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    await waitFor(() => expect(posted(fn, '/rides/r1/accept')).toHaveLength(1));
  });

  it('can decline a request', async () => {
    const fn = mockApi(base([['/drivers/me/ride-requests', () => ({ items: [offer] })], ['/rides/r1/decline', () => ({ declined: true })], ['/drivers/me', () => profile({ isOnline: true })]]));
    renderIt(<DriverHome />);
    fireEvent.click(await screen.findByRole('button', { name: 'Decline' }));
    await waitFor(() => expect(posted(fn, '/rides/r1/decline')).toHaveLength(1));
  });

  it('offers only the next valid step, and asks before completing a trip', async () => {
    let current = ride({ status: 'DRIVER_ARRIVED' });
    const fn = mockApi(base([
      ['/rides/r1/start', () => { current = ride({ status: 'IN_PROGRESS' }); return { ride: current }; }],
      ['/rides/r1/complete', () => ({ ride: ride({ status: 'COMPLETED' }) })],
      ['/rides/r1', () => ({ ride: current })],
      ['/drivers/me/rides', () => ({ items: [{ id: 'r1', status: current.status }], page: 1, pageSize: 5, total: 1 })],
      ['/drivers/me', () => profile({ isOnline: true })],
    ]));
    renderIt(<DriverHome />);
    expect(screen.queryByRole('button', { name: 'Complete trip' })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Start trip' }));
    await waitFor(() => expect(posted(fn, '/rides/r1/start')).toHaveLength(1));

    fireEvent.click(await screen.findByRole('button', { name: 'Complete trip' }));
    const dialog = await screen.findByRole('dialog', { hidden: true });
    expect(posted(fn, '/rides/r1/complete')).toHaveLength(0); // not sent until confirmed
    fireEvent.click(within(dialog).getByRole('button', { name: 'Complete trip' }));
    await waitFor(() => expect(posted(fn, '/rides/r1/complete')).toHaveLength(1));
  });
});

describe('DriverEarningsPage', () => {
  it('shows fares, the demonstration commission, the driver’s share and acceptance statistics', async () => {
    mockApi([['/drivers/me/earnings', () => earnings]]);
    renderIt(<DriverEarningsPage />);
    expect((await screen.findAllByText('Your earnings')).length).toBeGreaterThan(0);
    expect(screen.getByText(/R\s?440[,.]00/)).toBeInTheDocument(); // net: 80% of R550.00
    expect(screen.getByText(/Commission \(20%\)/)).toBeInTheDocument();
    expect(screen.getByText(/demonstration value, not a real RideWave rate/)).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Earnings by day' })).toBeInTheDocument();
  });
});

describe('passenger: no driver available', () => {
  it('lets the passenger search again', async () => {
    const fn = mockApi([['/rides/r1/retry', () => ({ ride: ride({ status: 'SEARCHING_FOR_DRIVER' }) })], ['/rides/r1', () => ({ ride: ride({ status: 'NO_DRIVER_AVAILABLE' }) })]]);
    renderIt(<RideDetailPage />, '/passenger/rides/r1', '/passenger/rides/:rideId');
    fireEvent.click(await screen.findByRole('button', { name: 'Search again' }));
    await waitFor(() => expect(posted(fn, '/rides/r1/retry')).toHaveLength(1));
    expect(await screen.findByText(/looking for an available driver nearby/)).toBeInTheDocument();
  });
});
