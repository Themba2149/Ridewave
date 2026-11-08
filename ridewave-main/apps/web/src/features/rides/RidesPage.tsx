import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert } from '../../components/ui/Alert';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { RideStatusBadge } from '../../components/ui/RideStatusBadge';
import { Skeleton } from '../../components/ui/Skeleton';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatDateTime, formatMinorAsRand } from '../../lib/formatters';
import { useMyRides, type Scope } from './api';

const SCOPES: Array<{ id: Scope; label: string }> = [{ id: 'all', label: 'All' }, { id: 'active', label: 'Active' }, { id: 'past', label: 'Past' }];
const PAGE_SIZE = 10;

export function RidesPage() {
  useDocumentTitle('My rides');
  const [scope, setScope] = useState<Scope>('all');
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useMyRides(scope, page, PAGE_SIZE);
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold">My rides</h1>
      <div role="group" aria-label="Filter rides" className="flex gap-2">
        {SCOPES.map((s) => (
          <button key={s.id} type="button" aria-pressed={scope === s.id} onClick={() => { setScope(s.id); setPage(1); }}
            className={`min-h-[44px] rounded-lg border px-4 text-sm font-semibold ${scope === s.id ? 'border-navy-900 bg-navy-900 text-ink' : 'border-navy-900/25'}`}>{s.label}</button>
        ))}
      </div>
      {isLoading && <Skeleton className="h-40" />}
      {error && <Alert tone="error">{error.message}</Alert>}
      {data && data.items.length === 0 && (
        <Card><p>No rides here yet.</p><div className="mt-3"><ButtonLink to="/passenger/book">Book a ride</ButtonLink></div></Card>
      )}
      {data && data.items.length > 0 && (
        <ul className="space-y-3">
          {data.items.map((r) => (
            <li key={r.id}>
              <Link to={`/passenger/rides/${r.id}`} className="block rounded-xl2 border border-navy-900/10 bg-white p-4 shadow-card hover:border-navy-900/30">
                <div className="flex flex-wrap items-center justify-between gap-2"><RideStatusBadge status={r.status} /><span className="text-sm text-navy-900/70">{formatDateTime(r.requestedAt)}</span></div>
                <p className="mt-2 font-semibold">{r.pickupAddress}</p>
                <p className="text-sm text-navy-900/75">to {r.dropoffAddress}</p>
                <p className="mt-2 text-sm">{r.categoryName} · {r.finalFareMinor !== null ? `Final ${formatMinorAsRand(r.finalFareMinor)}` : `Estimate ${formatMinorAsRand(r.estimatedFareMinor)}`}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {data && data.total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm">
          <span>Page {page} of {pages}</span>
          <span className="flex gap-2"><Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button><Button variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button></span>
        </div>
      )}
    </div>
  );
}
