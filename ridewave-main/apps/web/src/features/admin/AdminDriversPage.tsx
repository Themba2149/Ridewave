import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Pager } from '../../components/ui/Pager';
import { Skeleton } from '../../components/ui/Skeleton';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { qs, useAdminQuery } from './api';
import type { AdminDriver, Paged } from './types';

const PAGE_SIZE = 10;
export const approvalTone = (s: string) => (s === 'APPROVED' ? 'success' : s === 'PENDING' ? 'accent' : 'warning') as 'success' | 'accent' | 'warning';

export function AdminDriversPage() {
  useDocumentTitle('Drivers');
  const [params] = useSearchParams();
  const [approval, setApproval] = useState(params.get('approval') ?? '');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useAdminQuery<Paged<AdminDriver>>(['drivers', approval, query, page], `/admin/drivers${qs({ approval, search: query, page, pageSize: PAGE_SIZE })}`);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Drivers</h1>
      <Card>
        <form role="search" className="grid gap-3 sm:grid-cols-[1fr,auto,auto]" onSubmit={(e) => { e.preventDefault(); setPage(1); setQuery(search.trim()); }}>
          <label className="sr-only" htmlFor="d-search">Search drivers</label>
          <input id="d-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email" className="min-h-[44px] rounded-lg border border-navy-900/25 px-3.5" />
          <label className="sr-only" htmlFor="d-approval">Approval status</label>
          <select id="d-approval" value={approval} onChange={(e) => { setApproval(e.target.value); setPage(1); }} className="min-h-[44px] rounded-lg border border-navy-900/25 bg-white px-3">
            <option value="">Any approval status</option><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option><option value="SUSPENDED">Suspended</option>
          </select>
          <Button type="submit" variant="dark">Search</Button>
        </form>
        {isLoading && <Skeleton className="mt-4 h-40" />}
        {error && <div className="mt-4"><Alert tone="error">{error.message}</Alert></div>}
        {data && data.items.length === 0 && <p className="mt-4 text-navy-900/75">No drivers match.</p>}
        {data && data.items.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <caption className="sr-only">Drivers</caption>
              <thead><tr className="border-b border-navy-900/15"><th scope="col" className="py-2 pr-4">Driver</th><th scope="col" className="py-2 pr-4">Approval</th><th scope="col" className="py-2 pr-4">Online</th><th scope="col" className="py-2 pr-4">Vehicles</th><th scope="col" className="py-2 pr-4">Documents</th><th scope="col" className="py-2"><span className="sr-only">Review</span></th></tr></thead>
              <tbody>
                {data.items.map((d) => (
                  <tr key={d.id} className="border-b border-navy-900/10">
                    <td className="py-2 pr-4"><span className="block font-medium">{d.fullName}</span><span className="text-xs text-navy-900/70">{d.email}</span></td>
                    <td className="py-2 pr-4"><Badge tone={approvalTone(d.approvalStatus)}>{d.approvalStatus}</Badge></td>
                    <td className="py-2 pr-4">{d.isOnline ? 'Yes' : 'No'}</td><td className="py-2 pr-4">{d.vehicleCount}</td><td className="py-2 pr-4">{d.documentCount}</td>
                    <td className="py-2 text-right"><Link className="font-semibold underline" to={`/admin/drivers/${d.id}`}>Review<span className="sr-only"> {d.fullName}</span></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <Pager page={page} pageSize={PAGE_SIZE} total={data.total} onPage={setPage} />}
      </Card>
    </div>
  );
}
