import { useState } from 'react';
import { Alert } from '../../components/ui/Alert';
import { Card } from '../../components/ui/Card';
import { Pager } from '../../components/ui/Pager';
import { Skeleton } from '../../components/ui/Skeleton';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatDateTime } from '../../lib/formatters';
import { patch, qs, useAdminMutation, useAdminQuery } from './api';
import type { Paged, ReviewRow, Ticket } from './types';

const PAGE_SIZE = 10;
const STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

function Tickets() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useAdminQuery<Paged<Ticket>>(['tickets', status, page], `/admin/support-tickets${qs({ status, page, pageSize: PAGE_SIZE })}`);
  const update = useAdminMutation((v: { id: string; status: string }) => patch(`/admin/support-tickets/${v.id}`, { status: v.status }));
  return (
    <Card>
      <label className="text-sm font-medium">Status{' '}
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="ml-2 min-h-[44px] rounded-lg border border-navy-900/25 bg-white px-3"><option value="">All</option>{STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select>
      </label>
      {update.isError && <div className="mt-3"><Alert tone="error">{update.error.message}</Alert></div>}
      {isLoading && <Skeleton className="mt-4 h-32" />}
      {error && <div className="mt-4"><Alert tone="error">{error.message}</Alert></div>}
      {data && data.items.length === 0 && <p className="mt-4 text-navy-900/75">No support tickets.</p>}
      <ul className="mt-4 space-y-4">
        {data?.items.map((t) => (
          <li key={t.id} className="rounded-lg border border-navy-900/15 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="font-semibold">{t.subject}</p><p className="text-xs text-navy-900/70">{t.name} · {t.email} · {formatDateTime(t.createdAt)}</p></div>
              <div><label htmlFor={`t-${t.id}`} className="sr-only">Status for {t.subject}</label>
                <select id={`t-${t.id}`} value={t.status} onChange={(e) => update.mutate({ id: t.id, status: e.target.value })} className="min-h-[44px] rounded-lg border border-navy-900/25 bg-white px-3">{STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select></div>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm">{t.message}</p>
          </li>
        ))}
      </ul>
      {data && <Pager page={page} pageSize={PAGE_SIZE} total={data.total} onPage={setPage} />}
    </Card>
  );
}

function Reviews() {
  const [rating, setRating] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useAdminQuery<Paged<ReviewRow>>(['reviews', rating, page], `/admin/reviews${qs({ rating, page, pageSize: PAGE_SIZE })}`);
  return (
    <Card>
      <label className="text-sm font-medium">Rating{' '}
        <select value={rating} onChange={(e) => { setRating(e.target.value); setPage(1); }} className="ml-2 min-h-[44px] rounded-lg border border-navy-900/25 bg-white px-3"><option value="">All</option>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} star{n === 1 ? '' : 's'}</option>)}</select>
      </label>
      {isLoading && <Skeleton className="mt-4 h-32" />}
      {error && <div className="mt-4"><Alert tone="error">{error.message}</Alert></div>}
      {data && data.items.length === 0 && <p className="mt-4 text-navy-900/75">No reviews.</p>}
      <ul className="mt-4 space-y-3">
        {data?.items.map((r) => (
          <li key={r.id} className="rounded-lg border border-navy-900/15 p-4 text-sm">
            <p className="font-semibold"><span aria-label={`${r.rating} out of 5`}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span> <span className="font-normal text-navy-900/70">· {r.authorName} about {r.subjectName} · {formatDateTime(r.createdAt)}</span></p>
            {r.comment && <p className="mt-1">{r.comment}</p>}
          </li>
        ))}
      </ul>
      {data && <Pager page={page} pageSize={PAGE_SIZE} total={data.total} onPage={setPage} />}
    </Card>
  );
}

export function AdminSupportPage() {
  useDocumentTitle('Support and reviews');
  const [tab, setTab] = useState<'tickets' | 'reviews'>('tickets');
  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-3xl font-bold">Support and reviews</h1>
      <div role="group" aria-label="Section" className="flex gap-2">
        {(['tickets', 'reviews'] as const).map((t) => <button key={t} type="button" aria-pressed={tab === t} onClick={() => setTab(t)} className={`min-h-[44px] rounded-lg border px-4 text-sm font-semibold ${tab === t ? 'border-navy-900 bg-navy-900 text-ink' : 'border-navy-900/25'}`}>{t === 'tickets' ? 'Support tickets' : 'Reviews'}</button>)}
      </div>
      {tab === 'tickets' ? <Tickets /> : <Reviews />}
    </div>
  );
}
