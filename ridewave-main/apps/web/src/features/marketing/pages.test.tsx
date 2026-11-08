import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContactPage } from './ContactPage';
import { SafetyPage } from './SafetyPage';

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>);
}
afterEach(() => vi.unstubAllGlobals());

describe('ContactPage', () => {
  it('shows validation messages and does not call the API for an empty form', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    wrap(<ContactPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect(await screen.findByText('Enter your name')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('submits a valid message and shows the server response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ success: true, data: { message: 'Saved for testing.' } }) }));
    wrap(<ContactPage />);
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Thandi' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'thandi@example.com' } });
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Hello' } });
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'A long enough message.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await waitFor(() => expect(screen.getByText('Saved for testing.')).toBeInTheDocument());
  });
});

describe('SafetyPage', () => {
  it('does not claim background checks or an emergency button exist', () => {
    wrap(<SafetyPage />);
    expect(screen.getByText(/does not currently perform real background checks/)).toBeInTheDocument();
    expect(screen.getByText(/no in-app emergency button/)).toBeInTheDocument();
  });
});
