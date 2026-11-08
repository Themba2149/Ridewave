import { useQuery } from '@tanstack/react-query';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { apiFetch } from '../../lib/api-client';

type Health = {
  status: 'ok' | 'degraded';
  environment: string;
  database: 'up' | 'down';
  integrations: { maps: string; payments: string; email: string };
};

export function StatusPage() {
  useDocumentTitle('System status');
  const { data, error, isLoading, refetch } = useQuery({ queryKey: ['health'], queryFn: () => apiFetch<Health>('/health') });

  return (
    <div className="bg-navy-900 px-6 py-16 text-ink">
      <div className="mx-auto max-w-xl">
        <h1 className="text-3xl font-bold tracking-tight">RideWave</h1>
        <p className="mt-1 text-ink-muted">Your journey. Your way. Foundation build — system status.</p>

        <section aria-live="polite" className="mt-10 rounded-xl2 border border-white/10 bg-navy-800 p-6 shadow-card">
          <h2 className="text-lg font-semibold">API status</h2>
          {isLoading && <p className="mt-3 text-ink-muted">Checking the API…</p>}
          {error && (
            <div role="alert" className="mt-3">
              <p className="text-red-400">{error.message}</p>
              <button onClick={() => refetch()} className="mt-3 rounded-lg bg-accent px-4 py-2 font-semibold text-navy-900">Retry</button>
            </div>
          )}
          {data && (
            <dl className="mt-3 grid grid-cols-[auto,1fr] gap-x-6 gap-y-2">
              <dt className="text-ink-muted">Status</dt><dd>{data.status === 'ok' ? 'Operational' : 'Degraded'}</dd>
              <dt className="text-ink-muted">Database</dt><dd>{data.database}</dd>
              <dt className="text-ink-muted">Environment</dt><dd>{data.environment}</dd>
              <dt className="text-ink-muted">Maps</dt><dd>{data.integrations.maps === 'dev' ? 'Development substitute (not live)' : data.integrations.maps}</dd>
              <dt className="text-ink-muted">Payments</dt><dd>{data.integrations.payments === 'dev' ? 'Simulated (no real money moves)' : data.integrations.payments}</dd>
              <dt className="text-ink-muted">Email</dt><dd>{data.integrations.email === 'dev' ? 'Development only (nothing is sent)' : data.integrations.email}</dd>
            </dl>
          )}
        </section>
      </div>
    </div>
  );
}
