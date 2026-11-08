import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Pager } from '../../components/ui/Pager';
import { ReasonDialog } from '../../components/ui/ReasonDialog';
import { Skeleton } from '../../components/ui/Skeleton';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatDateTime } from '../../lib/formatters';
import { useCurrentUser } from '../auth/useAuth';
import { patch, qs, useAdminMutation, useAdminQuery } from './api';
import type { AdminUser, Paged } from './types';

type Sort = 'createdAt' | 'fullName' | 'email' | 'role';
const PAGE_SIZE = 10;

export function AdminUsersPage() {
  useDocumentTitle('Users');
  const { data: me } = useCurrentUser();
  const [params] = useSearchParams();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [role, setRole] = useState(params.get('role') ?? '');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState<Sort>('createdAt');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<AdminUser | null>(null);

  const { data, isLoading, error } = useAdminQuery<Paged<AdminUser>>(['users', query, role, status, sort, dir, page], `/admin/users${qs({ search: query, role, status, sort, dir, page, pageSize: PAGE_SIZE })}`);
  const change = useAdminMutation((v: { id: string; status: string; reason?: string }) => patch(`/admin/users/${v.id}/status`, { status: v.status, ...(v.reason ? { reason: v.reason } : {}) }));
  const suspending = target?.status === 'ACTIVE';

  const header = (key: Sort, label: string) => (
    <th scope="col" className="py-2 pr-4" aria-sort={sort === key ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="font-semibold underline-offset-2 hover:underline" onClick={() => { if (sort === key) setDir(dir === 'asc' ? 'desc' : 'asc'); else { setSort(key); setDir('asc'); } setPage(1); }}>{label}{sort === key ? (dir === 'asc' ? ' ▲' : ' ▼') : ''}</button>
    </th>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Users</h1>
      <Card>
        <form role="search" className="grid gap-3 sm:grid-cols-[1fr,auto,auto,auto]" onSubmit={(e) => { e.preventDefault(); setPage(1); setQuery(search.trim()); }}>
          <label className="sr-only" htmlFor="u-search">Search name or email</label>
          <input id="u-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email" className="min-h-[44px] rounded-lg border border-navy-900/25 px-3.5" />
          <label className="sr-only" htmlFor="u-role">Role</label>
          <select id="u-role" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} className="min-h-[44px] rounded-lg border border-navy-900/25 bg-white px-3"><option value="">All roles</option><option value="PASSENGER">Passengers</option><option value="DRIVER">Drivers</option><option value="ADMIN">Admins</option></select>
          <label className="sr-only" htmlFor="u-status">Status</label>
          <select id="u-status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="min-h-[44px] rounded-lg border border-navy-900/25 bg-white px-3"><option value="">Any status</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option><option value="DEACTIVATED">Deactivated</option></select>
          <Button type="submit" variant="dark">Search</Button>
        </form>
        {change.isError && <div className="mt-3"><Alert tone="error">{change.error.message}</Alert></div>}
        {change.isSuccess && <div className="mt-3"><Alert tone="success">Account updated and recorded in the audit log.</Alert></div>}
        {isLoading && <Skeleton className="mt-4 h-40" />}
        {error && <div className="mt-4"><Alert tone="error">{error.message}</Alert></div>}
        {data && data.items.length === 0 && <p className="mt-4 text-navy-900/75">No users match.</p>}
        {data && data.items.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <caption className="sr-only">Registered users</caption>
              <thead><tr className="border-b border-navy-900/15">{header('fullName', 'Name')}{header('email', 'Email')}{header('role', 'Role')}<th scope="col" className="py-2 pr-4">Status</th>{header('createdAt', 'Joined')}<th scope="col" className="py-2"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {data.items.map((u) => (
                  <tr key={u.id} className="border-b border-navy-900/10">
                    <td className="py-2 pr-4">{u.fullName}</td><td className="py-2 pr-4">{u.email}</td><td className="py-2 pr-4"><Badge>{u.role}</Badge></td>
                    <td className="py-2 pr-4"><Badge tone={u.status === 'ACTIVE' ? 'success' : 'warning'}>{u.status}</Badge></td><td className="py-2 pr-4">{formatDateTime(u.createdAt)}</td>
                    <td className="py-2 text-right">{u.id !== me?.id && <Button variant="outline" className="!min-h-[36px] !py-1" onClick={() => { change.reset(); setTarget(u); }}>{u.status === 'ACTIVE' ? 'Suspend' : 'Activate'}<span className="sr-only"> {u.fullName}</span></Button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <Pager page={page} pageSize={PAGE_SIZE} total={data.total} onPage={setPage} />}
      </Card>
      <ReasonDialog open={!!target} title={suspending ? `Suspend ${target?.fullName}?` : `Reactivate ${target?.fullName}?`} confirmLabel={suspending ? 'Suspend account' : 'Activate account'} pending={change.isPending}
        onCancel={() => setTarget(null)} onConfirm={(reason) => target && change.mutate({ id: target.id, status: suspending ? 'SUSPENDED' : 'ACTIVE', reason }, { onSettled: () => setTarget(null) })}>
        <p>{suspending ? 'They will be signed out immediately and cannot sign in until reactivated. Drivers are taken offline.' : 'They will be able to sign in again.'}</p>
      </ReasonDialog>
    </div>
  );
}
