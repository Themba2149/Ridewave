import { useState } from 'react';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Pager } from '../../components/ui/Pager';
import { Skeleton } from '../../components/ui/Skeleton';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatDateTime } from '../../lib/formatters';
import { qs, useAdminQuery } from './api';
import type { AuditRow, Paged } from './types';

const PAGE_SIZE = 15;

export function AdminAuditPage() {
  useDocumentTitle('Audit log');
  const [action, setAction] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useAdminQuery<Paged<AuditRow>>(['audit', query, page], `/admin/audit-logs${qs({ action: query, page, pageSize: PAGE_SIZE })}`);
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Audit log</h1>
      <Card>
        <p className="text-sm text-navy-900/75">A record of sensitive administrator actions: who did what, and when. Entries cannot be edited here.</p>
        <form role="search" className="mt-3 grid gap-3 sm:grid-cols-[1fr,auto]" onSubmit={(e) => { e.preventDefault(); setPage(1); setQuery(action.trim()); }}>
          <label className="sr-only" htmlFor="a-action">Filter by action</label>
          <input id="a-action" value={action} onChange={(e) => setAction(e.target.value)} placeholder="Filter by action, e.g. PRICING" className="min-h-[44px] rounded-lg border border-navy-900/25 px-3.5" />
          <Button type="submit" variant="dark">Filter</Button>
        </form>
        {isLoading && <Skeleton className="mt-4 h-40" />}
        {error && <div className="mt-4"><Alert tone="error">{error.message}</Alert></div>}
        {data && data.items.length === 0 && <p className="mt-4 text-navy-900/75">No audit entries yet.</p>}
        {data && data.items.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <caption className="sr-only">Audit log</caption>
              <thead><tr className="border-b border-navy-900/15"><th scope="col" className="py-2 pr-3">When</th><th scope="col" className="py-2 pr-3">Who</th><th scope="col" className="py-2 pr-3">Action</th><th scope="col" className="py-2">Details</th></tr></thead>
              <tbody>
                {data.items.map((a) => (
                  <tr key={a.id} className="border-b border-navy-900/10 align-top">
                    <td className="py-2 pr-3 whitespace-nowrap">{formatDateTime(a.createdAt)}</td><td className="py-2 pr-3">{a.actorEmail ?? 'System'}</td>
                    <td className="py-2 pr-3"><span className="font-mono text-xs font-semibold">{a.action}</span><span className="block text-xs text-navy-900/70">{a.entityType}</span></td>
                    <td className="py-2"><details><summary className="cursor-pointer text-xs font-semibold">View</summary><pre className="mt-1 max-w-md overflow-x-auto whitespace-pre-wrap rounded bg-navy-900/5 p-2 text-xs">{JSON.stringify(a.metadata ?? {}, null, 2)}</pre></details></td>
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
