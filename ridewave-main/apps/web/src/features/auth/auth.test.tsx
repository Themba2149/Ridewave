import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoginPage } from './LoginPage';
import { RegisterPage } from './RegisterPage';
import { RequireRole } from './RequireRole';
import { safeNextPath } from './auth-errors';

const json = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body });
const user = (role: string) => ({ id: '1', email: 'a@b.co', fullName: 'Thandi Nkosi', phone: null, role, status: 'ACTIVE' });

function app(initial: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initial]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route element={<RequireRole role="ADMIN" />}><Route path="/admin" element={<p>Admin area</p>} /></Route>
          <Route path="/passenger" element={<p>Passenger area</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
afterEach(() => vi.unstubAllGlobals());

describe('RequireRole', () => {
  it('sends signed-out visitors to the sign-in page', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(401, { success: false, error: { code: 'UNAUTHENTICATED', message: 'Sign in' } })));
    app('/admin');
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });
  it('sends users with the wrong role to their own dashboard', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(200, { success: true, data: { user: user('PASSENGER') } })));
    app('/admin');
    expect(await screen.findByText('Passenger area')).toBeInTheDocument();
  });
  it('lets the right role in', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(200, { success: true, data: { user: user('ADMIN') } })));
    app('/admin');
    expect(await screen.findByText('Admin area')).toBeInTheDocument();
  });
});

describe('LoginPage', () => {
  it('signs in and goes to the role dashboard', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(200, { success: true, data: { user: user('PASSENGER') } })));
    app('/login');
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.co' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'whatever-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
    expect(await screen.findByText('Passenger area')).toBeInTheDocument();
  });
  it('shows the server error for wrong credentials and stays on the page', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(401, { success: false, error: { code: 'UNAUTHENTICATED', message: 'Incorrect email or password.' } })));
    app('/login');
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.co' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password.');
  });
});

describe('RegisterPage', () => {
  it('sends only the expected fields (never confirmPassword) and shows server conflicts', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(409, { success: false, error: { code: 'CONFLICT', message: 'An account with this email or phone number already exists.' } }));
    vi.stubGlobal('fetch', fetchMock);
    app('/register');
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Thandi Nkosi' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'thandi@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Sunrise2026x' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'Sunrise2026x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/already exists/));
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body).toEqual({ role: 'PASSENGER', fullName: 'Thandi Nkosi', email: 'thandi@example.com', password: 'Sunrise2026x' });
  });
});

describe('safeNextPath', () => {
  it('only allows same-site relative paths', () => {
    expect(safeNextPath('/passenger')).toBe('/passenger');
    expect(safeNextPath('//evil.example')).toBeNull();
    expect(safeNextPath('https://evil.example')).toBeNull();
    expect(safeNextPath(null)).toBeNull();
  });
});
