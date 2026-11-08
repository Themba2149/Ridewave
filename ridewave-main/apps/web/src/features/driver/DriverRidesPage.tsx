import { useState } from 'react';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Card } from '../../components/ui/Card';
import { RideStatusBadge } from '../../components/ui/RideStatusBadge';
import { Skeleton } from '../../components/ui/Skeleton';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatDateTime, formatMinorAsRand } from '../../lib/formatters';
import { useConfirmCash } from '../payments/api';
import { useDriverRides, type DriverRideSummary } from './api';

const PAGE_SIZE = 10;

export function DriverRidesPage() {
  useDocumentTitle('Trip history');
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useDriverRides('all', page, PAGE_SIZE);
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const confirmCash = useConfirmCash();
  const [cashFor, setCashFor] = useState<DriverRideSummary | null>(null);
  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold">Trip history</h1>
      {isLoading && <Skeleton className="h-40" />}
      {error && <Alert tone="error">{error.message}</Alert>}
      {data && data.items.length === 0 && <Card><p>No trips yet. Go online from the Overview tab to receive requests.</p></Card>}
      {data && data.items.length > 0 && (
        <ul className="space-y-3">
          {data.items.map((r) => (
            <li key={r.id} className="rounded-xl2 border border-navy-900/10 bg-white p-4 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-2"><RideStatusBadge status={r.status} /><span className="text-sm text-navy-900/70">{formatDateTime(r.completedAt ?? r.requestedAt)}</span></div>
              <p className="mt-2 font-semibold">{r.pickupAddress}</p><p className="text-sm text-navy-900/75">to {r.dropoffAddress}</p>
              <p className="mt-2 text-sm">{r.categoryName} · {r.finalFareMinor !== null ? `Fare ${formatMinorAsRand(r.finalFareMinor)}` : `Estimate ${formatMinorAsRand(r.estimatedFareMinor)}`}</p>
              {r.status === 'COMPLETED' && r.payment && <p className="mt-1 text-sm text-navy-900/75">Payment: {r.payment.method === 'CASH' ? 'cash' : r.payment.method === 'CARD' ? 'card' : 'wallet'} · {r.payment.status === 'SUCCEEDED' ? 'paid' : r.payment.status.toLowerCase()}</p>}
              {r.status === 'COMPLETED' && r.payment?.method === 'CASH' && r.payment.status === 'PENDING' && (
                <div className="mt-2"><Button variant="outline" className="!min-h-[36px] !py-1" onClick={() => { confirmCash.reset(); setCashFor(r); }}>Confirm cash received<span className="sr-only"> for the trip to {r.dropoffAddress}</span></Button></div>
              )}
            </li>
          ))}
        </ul>
      )}
      {confirmCash.isError && <Alert tone="error">{confirmCash.error.message}</Alert>}
      <ConfirmDialog open={!!cashFor} title="Confirm cash received?" confirmLabel="Yes, I received the cash" cancelLabel="Not yet" pending={confirmCash.isPending}
        onCancel={() => setCashFor(null)} onConfirm={() => cashFor && confirmCash.mutate(cashFor.id, { onSettled: () => setCashFor(null) })}>
        <p>Only confirm once the passenger has handed you {cashFor?.finalFareMinor != null ? formatMinorAsRand(cashFor.finalFareMinor) : 'the fare'}. This marks the payment as paid and cannot be undone.</p>
      </ConfirmDialog>
      {data && data.total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm"><span>Page {page} of {pages}</span>
          <span className="flex gap-2"><Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button><Button variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button></span></div>
      )}
    </div>
  );
}
