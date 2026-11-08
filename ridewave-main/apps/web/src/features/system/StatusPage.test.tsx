import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StatusPage } from './StatusPage';

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><StatusPage /></QueryClientProvider>);
}

afterEach(() => vi.unstubAllGlobals());

describe('StatusPage', () => {
  it('shows API status and labels simulated integrations honestly', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ success: true, data: { status: 'ok', environment: 'development', database: 'up', integrations: { maps: 'dev', payments: 'dev', email: 'dev' } } }),
    }));
    renderPage();
    expect(await screen.findByText('Operational')).toBeInTheDocument();
    expect(screen.getByText(/Simulated \(no real money moves\)/)).toBeInTheDocument();
  });

  it('shows an actionable error when the API is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent(/Cannot reach the RideWave API/);
  });
});
