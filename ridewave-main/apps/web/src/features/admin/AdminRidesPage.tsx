import { useState } from 'react';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { InfoDialog } from '../../components/ui/InfoDialog';
import { Pager } from '../../components/ui/Pager';
import { ReasonDialog } from '../../components/ui/ReasonDialog';
import { RideStatusBadge } from '../../components/ui/RideStatusBadge';
import { Skeleton } from '../../components/ui/Skeleton';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatDateTime, formatMinorAsRand } from '../../lib/formatters';
import { STATUS_LABEL, type RideStatus } from '../../lib/ride-status';
import type { RideDetail } from '../rides/types';
import { post, qs, useAdminMutation, useAdminQuery } from './api';
import type { AdminRide, Paged } from './types';

const PAGE_SIZE = 10;
const CANCELLABLE: RideStatus[] = ['REQUESTED', 'SEARCHING_FOR_DRIVER', 'DRIVER_ASSIGNED', 'DRIVER_ARRIVING', 'DRIVER_ARRIVED', 'NO_DRIVER_AVAILABLE'];

function RideInfo({ id }: { id: string }) {
  const { data, isLoading, error } = useAdminQuery<{ ride: RideDetail }>(['ride', id], `/rides/${id}`);
  if (isLoading) return <Skeleton className="h-32" />;
  if (error || !data) return <Alert tone="error">{error?.message ?? 'Not found'}</Alert>;
  const r = data.ride;
  return (
    <div className="space-y-3 text-sm">
      <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1">
        <dt className="text-navy-900/70">From</dt><dd>{r.pickup.address}</dd><dt className="text-navy-900/70">To</dt><dd>{r.dropoff.address}</dd>
        <dt className="text-navy-900/70">Category</dt><dd>{r.category.name}</dd><dt className="text-navy-900/70">Driver</dt><dd>{r.driver?.fullName ?? 'Not assigned'}</dd>
        <dt className="text-navy-900/70">Estimated fare</dt><dd>{formatMinorAsRand(r.estimatedFareMinor)}</dd>
        {r.finalFareMinor !== null && <><dt className="text-navy-900/70">Final fare</dt><dd>{formatMinorAsRand(r.finalFareMinor)}</dd></>}
        {r.cancellationReason && <><dt className="text-navy-900/70">Cancelled</dt><dd>{r.cancelledBy}: {r.cancellationReason}</dd></>}
      </dl>
      <div><p className="font-semibold">Status history</p>
        <ol className="mt-1 space-y-1 border-l-2 border-navy-900/15 pl-3">{r.statusHistory.map((h, i) => <li key={i}>{STATUS_LABEL[h.toStatus]} <span className="text-navy-900/70">· {h.actorType.toLowerCase()} · {formatDateTime(h.createdAt)}{h.note ? ` · ${h.note}` : ''}</span></li>)}</ol></div>
    </div>
  );
}

export function AdminRidesPage() {
  useDocumentTitle('Rides');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState<AdminRide | null>(null);
  const [cancelling, setCancelling] = useState<AdminRide | null>(null);
  const { data, isLoading, error } = useAdminQuery<Paged<AdminRide>>(['rides', status, query, page], `/admin/rides${qs({ status, search: query, page, pageSize: PAGE_SIZE })}`);
  const cancel = useAdminMutation((v: { id: string; reason: string }) => post(`/admin/rides/${v.id}/cancel`, { reason: v.reason }));

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Rides</h1>
      <Card>
        <form role="search" className="grid gap-3 sm:grid-cols-[1fr,auto,auto]" onSubmit={(e) => { e.preventDefault(); setPage(1); setQuery(search.trim()); }}>
          <label className="sr-only" htmlFor="r-search">Search by address</label>
          <input id="r-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search pickup or destination" className="min-h-[44px] rounded-lg border border-navy-900/25 px-3.5" />
          <label className="sr-only" htmlFor="r-status">Status</label>
          <select id="r-status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="min-h-[44px] rounded-lg border border-navy-900/25 bg-white px-3">
            <option value="">Any status</option>{(Object.keys(STATUS_LABEL) as RideStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
          <Button type="submit" variant="dark">Search</Button>
        </form>
        {cancel.isSuccess && <div className="mt-3"><Alert tone="success">Ride cancelled and recorded in the audit log.</Alert></div>}
        {isLoading && <Skeleton className="mt-4 h-40" />}
        {error && <div className="mt-4"><Alert tone="error">{error.message}</Alert></div>}
        {data && data.items.length === 0 && <p className="mt-4 text-navy-900/75">No rides match.</p>}
        {data && data.items.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <caption className="sr-only">Rides</caption>
              <thead><tr className="border-b border-navy-900/15"><th scope="col" className="py-2 pr-3">Requested</th><th scope="col" className="py-2 pr-3">Passenger</th><th scope="col" className="py-2 pr-3">Trip</th><th scope="col" className="py-2 pr-3">Driver</th><th scope="col" className="py-2 pr-3">Status</th><th scope="col" className="py-2 pr-3 text-right">Fare</th><th scope="col" className="py-2"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {data.items.map((r) => (
                  <tr key={r.id} className="border-b border-navy-900/10 align-top">
                    <td className="py-2 pr-3">{formatDateTime(r.requestedAt)}</td><td className="py-2 pr-3">{r.passengerName}</td>
                    <td className="py-2 pr-3">{r.pickupAddress}<span className="block text-xs text-navy-900/70">to {r.dropoffAddress}</span></td><td className="py-2 pr-3">{r.driverName ?? '–'}</td>
                    <td className="py-2 pr-3"><RideStatusBadge status={r.status} /></td><td className="py-2 pr-3 text-right">{formatMinorAsRand(r.finalFareMinor ?? r.estimatedFareMinor)}</td>
                    <td className="py-2 text-right whitespace-nowrap">
                      <Button variant="outline" className="!min-h-[36px] !py-1" onClick={() => setViewing(r)}>Details</Button>{' '}
                      {CANCELLABLE.includes(r.status) && <Button variant="outline" className="!min-h-[36px] !py-1" onClick={() => { cancel.reset(); setCancelling(r); }}>Cancel</Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <Pager page={page} pageSize={PAGE_SIZE} total={data.total} onPage={setPage} />}
      </Card>
      <InfoDialog open={!!viewing} title="Ride details" onClose={() => setViewing(null)}>{viewing && <RideInfo id={viewing.id} />}</InfoDialog>
      <ReasonDialog open={!!cancelling} required title="Cancel this ride?" confirmLabel="Cancel ride" label="Reason (recorded in the audit log)" pending={cancel.isPending} error={cancel.error?.message}
        onCancel={() => setCancelling(null)} onConfirm={(reason) => cancelling && cancel.mutate({ id: cancelling.id, reason }, { onSuccess: () => setCancelling(null) })}>
        <p>The passenger is not charged. The driver (if assigned) is released.</p>
      </ReasonDialog>
    </div>
  );
}
