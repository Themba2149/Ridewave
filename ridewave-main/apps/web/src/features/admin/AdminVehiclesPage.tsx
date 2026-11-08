import { useState } from 'react';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Pager } from '../../components/ui/Pager';
import { Skeleton } from '../../components/ui/Skeleton';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { patch, qs, useAdminMutation, useAdminQuery } from './api';
import type { AdminVehicle, Paged } from './types';

const PAGE_SIZE = 10;

export function AdminVehiclesPage() {
  useDocumentTitle('Vehicles');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [active, setActive] = useState('');
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<AdminVehicle | null>(null);
  const { data, isLoading, error } = useAdminQuery<Paged<AdminVehicle>>(['vehicles', query, active, page], `/admin/vehicles${qs({ search: query, active, page, pageSize: PAGE_SIZE })}`);
  const toggle = useAdminMutation((v: { id: string; isActive: boolean }) => patch(`/admin/vehicles/${v.id}`, { isActive: v.isActive }));

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Vehicles</h1>
      <Card>
        <form role="search" className="grid gap-3 sm:grid-cols-[1fr,auto,auto]" onSubmit={(e) => { e.preventDefault(); setPage(1); setQuery(search.trim()); }}>
          <label className="sr-only" htmlFor="v-search">Search vehicles</label>
          <input id="v-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Registration, make, model or driver" className="min-h-[44px] rounded-lg border border-navy-900/25 px-3.5" />
          <label className="sr-only" htmlFor="v-active">Active</label>
          <select id="v-active" value={active} onChange={(e) => { setActive(e.target.value); setPage(1); }} className="min-h-[44px] rounded-lg border border-navy-900/25 bg-white px-3"><option value="">Active and inactive</option><option value="true">Active only</option><option value="false">Inactive only</option></select>
          <Button type="submit" variant="dark">Search</Button>
        </form>
        {toggle.isError && <div className="mt-3"><Alert tone="error">{toggle.error.message}</Alert></div>}
        {isLoading && <Skeleton className="mt-4 h-40" />}
        {error && <div className="mt-4"><Alert tone="error">{error.message}</Alert></div>}
        {data && data.items.length === 0 && <p className="mt-4 text-navy-900/75">No vehicles match.</p>}
        {data && data.items.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <caption className="sr-only">Vehicles</caption>
              <thead><tr className="border-b border-navy-900/15"><th scope="col" className="py-2 pr-3">Vehicle</th><th scope="col" className="py-2 pr-3">Registration</th><th scope="col" className="py-2 pr-3">Category</th><th scope="col" className="py-2 pr-3">Driver</th><th scope="col" className="py-2 pr-3">Status</th><th scope="col" className="py-2"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {data.items.map((v) => (
                  <tr key={v.id} className="border-b border-navy-900/10">
                    <td className="py-2 pr-3">{v.year} {v.make} {v.model}<span className="block text-xs text-navy-900/70">{v.colour} · {v.passengerCapacity} seats</span></td>
                    <td className="py-2 pr-3 font-mono font-semibold">{v.registration}</td><td className="py-2 pr-3">{v.categoryName}</td><td className="py-2 pr-3">{v.driverName}</td>
                    <td className="py-2 pr-3"><Badge tone={v.isActive ? 'success' : 'warning'}>{v.isActive ? 'Active' : 'Inactive'}</Badge></td>
                    <td className="py-2 text-right"><Button variant="outline" className="!min-h-[36px] !py-1" onClick={() => { toggle.reset(); setTarget(v); }}>{v.isActive ? 'Deactivate' : 'Activate'}<span className="sr-only"> {v.registration}</span></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <Pager page={page} pageSize={PAGE_SIZE} total={data.total} onPage={setPage} />}
      </Card>
      <ConfirmDialog open={!!target} title={target?.isActive ? 'Deactivate this vehicle?' : 'Activate this vehicle?'} confirmLabel={target?.isActive ? 'Deactivate' : 'Activate'} cancelLabel="Cancel" pending={toggle.isPending}
        onCancel={() => setTarget(null)} onConfirm={() => target && toggle.mutate({ id: target.id, isActive: !target.isActive }, { onSettled: () => setTarget(null) })}>
        <p>{target?.isActive ? `${target.registration} will stop being offered rides.` : `${target?.registration} can be offered rides again.`}</p>
      </ConfirmDialog>
    </div>
  );
}
