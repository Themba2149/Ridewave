import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DriverDocumentsPage, validateFile } from '../driver/DriverDocumentsPage';
import { AdminDriverDetailPage } from './AdminDriverDetailPage';
import { AdminHome } from './AdminHome';
import { AdminPricingPage } from './AdminPricingPage';
import { AdminRidesPage } from './AdminRidesPage';
import { AdminUsersPage } from './AdminUsersPage';

vi.mock('./VolumeChart', () => ({ default: () => <div>chart placeholder</div> }));

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

const analytics = {
  generatedAt: new Date().toISOString(), days: 14, notes: { revenue: 'Sum of final fares of completed rides.', volume: 'Counted by day.' },
  overview: { totalUsers: 12, passengers: 7, drivers: 4, pendingDriverApprovals: 2, activeRides: 1, completedRides: 30, cancelledRides: 5, revenueMinor: 1234500 },
  volume: [{ date: '2026-10-16', requested: 3, completed: 2, cancelled: 1, revenueMinor: 55000 }],
  recentRides: [{ id: 'r1', status: 'COMPLETED', categoryName: 'RideWave Economy', passengerName: 'Pat Passenger', driverName: 'Dee Driver', pickupAddress: 'Sandton City', dropoffAddress: 'Rosebank', estimatedFareMinor: 5000, finalFareMinor: 5000, requestedAt: new Date().toISOString() }],
  topDrivers: [{ driverId: 'd1', name: 'Dee Driver', approvalStatus: 'APPROVED', isOnline: true, ratingAverage: 4.8, ratingCount: 5, completedTrips: 9, grossMinor: 90000 }],
};
const user = (id: string, status = 'ACTIVE') => ({ id, email: `${id}@example.com`, fullName: `Person ${id}`, role: 'PASSENGER', status, createdAt: new Date().toISOString() });

describe('AdminHome', () => {
  it('shows figures from the analytics API and labels revenue honestly', async () => {
    mockApi([['/admin/analytics', () => analytics]]);
    renderAt(<AdminHome />);
    expect(await screen.findByText('Registered users')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Pending driver approvals/ })).toHaveAttribute('href', '/admin/drivers?approval=PENDING');
    expect(screen.getByText(/Not money received/)).toBeInTheDocument();
    expect(screen.getByText('Pat Passenger')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Daily ride volume and fares' })).toBeInTheDocument();
  });
});

describe('AdminUsersPage', () => {
  const handlers = (extra: Array<[string, Handler]> = []): Array<[string, Handler]> => [
    ...extra, ['/auth/me', () => ({ user: { ...user('me'), role: 'ADMIN' } })],
    ['/admin/users', () => ({ items: [user('me'), user('u1'), user('u2', 'SUSPENDED')], page: 1, pageSize: 10, total: 3 })],
  ];

  it('asks for confirmation before suspending, then sends the reason; admins cannot change themselves', async () => {
    const fn = mockApi(handlers([['/admin/users/u1/status', () => ({ user: user('u1', 'SUSPENDED') })]]));
    renderAt(<AdminUsersPage />);
    await screen.findAllByText('Person u1');
    expect(screen.queryByRole('button', { name: /Suspend Person me/ })).not.toBeInTheDocument(); // own account has no action
    expect(screen.getByRole('button', { name: /Activate Person u2/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Suspend Person u1/ }));
    const dialog = await screen.findByRole('dialog', { name: /Suspend Person u1/, hidden: true });
    expect(calls(fn, '/status', 'PATCH')).toHaveLength(0);
    fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: 'Abusive messages' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Suspend account' }));
    await waitFor(() => expect(calls(fn, '/admin/users/u1/status', 'PATCH')).toHaveLength(1));
    expect(body(calls(fn, '/status', 'PATCH')[0]!)).toEqual({ status: 'SUSPENDED', reason: 'Abusive messages' });
  });

  it('passes search, role and sort to the API', async () => {
    const fn = mockApi(handlers());
    renderAt(<AdminUsersPage />);
    await screen.findAllByText('Person u1');
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'DRIVER' } });
    fireEvent.click(screen.getByRole('button', { name: /Name/ }));
    await waitFor(() => expect(fn.mock.calls.some(([u]) => /role=DRIVER/.test(String(u)) && /sort=fullName/.test(String(u)))).toBe(true));
  });
});

describe('AdminDriverDetailPage', () => {
  const driver = { id: 'd1', userId: 'u', fullName: 'Dee Driver', email: 'dee@example.com', phone: null, approvalStatus: 'PENDING', approvalNote: null, isOnline: false, ratingAverage: 0, ratingCount: 0, vehicleCount: 1, documentCount: 1,
    vehicles: [{ id: 'v1', driverName: 'Dee', make: 'Toyota', model: 'Etios', year: 2019, colour: 'White', registration: 'DEMO001GP', passengerCapacity: 4, isActive: true, categoryName: 'RideWave Economy' }],
    documents: [{ id: 'doc1', type: 'DRIVERS_LICENCE', status: 'SUBMITTED', originalName: 'licence.pdf', mimeType: 'application/pdf', sizeBytes: 2048, reviewNote: null, createdAt: new Date().toISOString(), reviewedAt: null }] };
  const base = (extra: Array<[string, Handler]> = []): Array<[string, Handler]> => [...extra, ['/admin/drivers/d1', () => ({ driver })]];

  it('approves with one confirmation and says plainly that nothing is verified automatically', async () => {
    const fn = mockApi(base([['/admin/drivers/d1/approval', () => ({ driver })]]));
    renderAt(<AdminDriverDetailPage />, '/admin/drivers/d1', '/admin/drivers/:driverId');
    expect(await screen.findByText(/does not verify identity or legal documents automatically/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Approve this driver?', hidden: true })).getByRole('button', { name: 'Confirm approved' }));
    await waitFor(() => expect(calls(fn, '/approval', 'PATCH')).toHaveLength(1));
    expect(body(calls(fn, '/approval', 'PATCH')[0]!)).toEqual({ status: 'APPROVED' });
  });

  it('will not reject a document without a reason, then sends the reason', async () => {
    const fn = mockApi(base([['/admin/documents/doc1', () => ({ document: {} })]]));
    renderAt(<AdminDriverDetailPage />, '/admin/drivers/d1', '/admin/drivers/:driverId');
    expect(await screen.findByRole('link', { name: /Open/ })).toHaveAttribute('href', '/api/v1/admin/documents/doc1/download');
    fireEvent.click(await screen.findByRole('button', { name: 'Reject Driver’s licence' }));
    const dialog = await screen.findByRole('dialog', { name: /Reject Driver’s licence\?/, hidden: true });
    fireEvent.click(within(dialog).getByRole('button', { name: /Yes, rejected/ }));
    expect(await within(dialog).findByText(/give a reason/i)).toBeInTheDocument();
    expect(calls(fn, '/admin/documents/doc1', 'PATCH')).toHaveLength(0);
    fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: 'Photo is blurry' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /Yes, rejected/ }));
    await waitFor(() => expect(calls(fn, '/admin/documents/doc1', 'PATCH')).toHaveLength(1));
    expect(body(calls(fn, '/admin/documents/doc1', 'PATCH')[0]!)).toEqual({ status: 'REJECTED', note: 'Photo is blurry' });
  });
});

describe('AdminPricingPage', () => {
  const row = { id: 'pc1', categoryCode: 'ECONOMY', categoryName: 'RideWave Economy', currency: 'ZAR', baseFareMinor: 1500, perKmMinor: 750, perMinuteMinor: 900, minimumFareMinor: 3000, bookingFeeMinor: 500, cancellationFeeMinor: 2000, freeCancelWindowSeconds: 120, demandMultiplierBp: 10000, roundingMinor: 100 };
  const base = (extra: Array<[string, Handler]> = []): Array<[string, Handler]> => [...extra, ['/admin/pricing', () => ({ items: [row] })], ['/admin/categories', () => ({ items: [{ id: 'c1', code: 'ECONOMY', name: 'RideWave Economy', description: 'd', capacity: 4, isActive: true }] })]];

  it('shows rates in rand and sends only the changed field, converted to whole cents', async () => {
    const fn = mockApi(base([['/admin/pricing', (init) => (init?.method === 'PATCH' ? { pricing: row } : { items: [row] })]]));
    renderAt(<AdminPricingPage />);
    const base_ = await screen.findByLabelText('Base fare (R)');
    expect(base_).toHaveValue('15.00');
    expect(screen.getByText(/demonstration rates/)).toBeInTheDocument();
    fireEvent.change(base_, { target: { value: '19.99' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save pricing' }));
    await waitFor(() => expect(calls(fn, '/admin/pricing', 'PATCH')).toHaveLength(1));
    expect(body(calls(fn, '/admin/pricing', 'PATCH')[0]!)).toEqual({ categoryCode: 'ECONOMY', baseFareMinor: 1999 });
  });

  it('rejects invalid values on the page and sends nothing; says when nothing changed', async () => {
    const fn = mockApi(base());
    renderAt(<AdminPricingPage />);
    const perKm = await screen.findByLabelText('Per kilometre (R)');
    fireEvent.change(perKm, { target: { value: '7.555' } });
    fireEvent.change(screen.getByLabelText('Demand multiplier (×)'), { target: { value: '0.80' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save pricing' }));
    expect(await screen.findByText('Enter an amount like 12.50')).toBeInTheDocument();
    expect(screen.getByText('Enter 1.00 or more, e.g. 1.25')).toBeInTheDocument();
    expect(calls(fn, '/admin/pricing', 'PATCH')).toHaveLength(0);
    fireEvent.change(perKm, { target: { value: '7.50' } });
    fireEvent.change(screen.getByLabelText('Demand multiplier (×)'), { target: { value: '1.00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save pricing' }));
    expect(await screen.findByText('No changes to save.')).toBeInTheDocument();
    expect(calls(fn, '/admin/pricing', 'PATCH')).toHaveLength(0);
  });
});

describe('AdminRidesPage', () => {
  const ride = (id: string, status: string) => ({ id, status, categoryName: 'RideWave Economy', passengerName: 'Pat', driverName: null, pickupAddress: 'Sandton City', dropoffAddress: 'Rosebank', estimatedFareMinor: 5000, finalFareMinor: null, requestedAt: new Date().toISOString() });
  it('offers cancel only for cancellable rides and requires a reason', async () => {
    const fn = mockApi([['/admin/rides/r1/cancel', () => ({ ride: {} })], ['/admin/rides', () => ({ items: [ride('r1', 'SEARCHING_FOR_DRIVER'), ride('r2', 'COMPLETED')], page: 1, pageSize: 10, total: 2 })]]);
    renderAt(<AdminRidesPage />);
    await screen.findAllByText('Sandton City');
    expect(screen.getAllByRole('button', { name: 'Cancel' })).toHaveLength(1); // the completed ride has none
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cancel this ride?', hidden: true });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel ride' }));
    expect(await within(dialog).findByText(/give a reason/i)).toBeInTheDocument();
    expect(calls(fn, '/cancel', 'POST')).toHaveLength(0);
    fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: 'Passenger called support' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel ride' }));
    await waitFor(() => expect(calls(fn, '/admin/rides/r1/cancel', 'POST')).toHaveLength(1));
    expect(body(calls(fn, '/cancel', 'POST')[0]!)).toEqual({ reason: 'Passenger called support' });
  });
});

describe('driver documents upload', () => {
  const file = (name: string, size = 100, type = 'application/pdf') => new File([new Uint8Array(size)], name, { type });

  it('validates by extension and size in the browser (the server re-checks the real content)', () => {
    expect(validateFile(undefined)).toMatch(/Choose a file/);
    expect(validateFile(file('a.pdf'))).toBe('');
    expect(validateFile(file('a.PNG'))).toBe('');
    expect(validateFile(file('a.jpeg'))).toBe('');
    expect(validateFile(file('a.exe'))).toMatch(/Only PDF/);
    expect(validateFile(file('a.pdf', 5 * 1024 * 1024 + 1))).toMatch(/5 MB/);
    expect(validateFile(file('a.pdf', 0))).toMatch(/empty/);
  });

  it('uploads a chosen file as multipart form data with the document type', async () => {
    const fn = mockApi([['/drivers/me/documents', (init) => (init?.method === 'POST' ? { document: {} } : { items: [] })]]);
    renderAt(<DriverDocumentsPage />);
    await screen.findByText(/not uploaded anything yet/);
    fireEvent.change(screen.getByLabelText('Document type'), { target: { value: 'PROOF_OF_ADDRESS' } });
    fireEvent.change(screen.getByLabelText(/File \(PDF/), { target: { files: [file('bill.pdf')] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));
    await waitFor(() => expect(calls(fn, '/drivers/me/documents', 'POST')).toHaveLength(1));
    const form = (calls(fn, '/drivers/me/documents', 'POST')[0]![1] as { body: FormData; headers: Record<string, string> });
    expect(form.body).toBeInstanceOf(FormData);
    expect(form.body.get('type')).toBe('PROOF_OF_ADDRESS');
    expect((form.body.get('file') as File).name).toBe('bill.pdf');
    expect(form.headers['Content-Type']).toBeUndefined(); // the browser sets the multipart boundary
  });

  it('refuses a wrong file type without calling the server', async () => {
    const fn = mockApi([['/drivers/me/documents', () => ({ items: [] })]]);
    renderAt(<DriverDocumentsPage />);
    await screen.findByText(/not uploaded anything yet/);
    fireEvent.change(screen.getByLabelText(/File \(PDF/), { target: { files: [file('virus.exe')] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Only PDF, PNG or JPEG/);
    expect(calls(fn, '/drivers/me/documents', 'POST')).toHaveLength(0);
  });
});
