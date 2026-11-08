import { useState } from 'react';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Pager } from '../../components/ui/Pager';
import { Skeleton } from '../../components/ui/Skeleton';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatDateTime } from '../../lib/formatters';
import { useMarkAllRead, useMarkRead, useNotificationList } from './api';

export function NotificationsPage() {
  useDocumentTitle('Notifications');
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const { data, isLoading, error } = useNotificationList(page, unreadOnly);
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Notifications</h1>
        <div className="flex gap-2">
          <Button variant="outline" aria-pressed={unreadOnly} onClick={() => { setUnreadOnly((v) => !v); setPage(1); }}>{unreadOnly ? 'Showing unread' : 'Show unread only'}</Button>
          <Button variant="outline" disabled={!data || data.unread === 0 || markAll.isPending} onClick={() => markAll.mutate()}>Mark all as read</Button>
        </div>
      </div>
      <p className="text-sm text-navy-900/70">These are in-app notifications. No emails or text messages are sent in this demonstration.</p>
      {isLoading && <Skeleton className="h-40" />}
      {error && <Alert tone="error">{error.message}</Alert>}
      {data && data.items.length === 0 && <Card><p>{unreadOnly ? 'No unread notifications.' : 'Nothing here yet. Updates about your rides and payments will appear here.'}</p></Card>}
      {data && data.items.length > 0 && (
        <ul className="space-y-3">
          {data.items.map((n) => (
            <li key={n.id} className={`rounded-xl2 border p-4 shadow-card ${n.readAt ? 'border-navy-900/10 bg-white' : 'border-accent-dark/60 bg-accent/10'}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="font-semibold">{!n.readAt && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-accent-dark" aria-label="Unread" />}{n.title}</p><p className="mt-1 text-sm">{n.body}</p><p className="mt-1 text-xs text-navy-900/60">{formatDateTime(n.createdAt)}</p></div>
                {!n.readAt && <Button variant="outline" className="!min-h-[36px] !py-1" onClick={() => markRead.mutate(n.id)}>Mark as read<span className="sr-only">: {n.title}</span></Button>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {data && <Pager page={page} pageSize={15} total={data.total} onPage={setPage} />}
    </div>
  );
}
