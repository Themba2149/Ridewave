import { useState } from 'react';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { post, useAdminMutation } from './api';

const AUDIENCES = [{ v: 'ALL', l: 'All passengers and drivers' }, { v: 'PASSENGER', l: 'Passengers only' }, { v: 'DRIVER', l: 'Drivers only' }] as const;

export function AdminNotificationsPage() {
  useDocumentTitle('Announcements');
  const [audience, setAudience] = useState<'ALL' | 'PASSENGER' | 'DRIVER'>('ALL');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [problem, setProblem] = useState('');
  const [confirming, setConfirming] = useState(false);
  const send = useAdminMutation((v: { audience: string; title: string; body: string }) => post<{ sent: number }>('/admin/notifications', v));

  const review = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 3 || title.trim().length > 80) return setProblem('The title must be 3 to 80 characters.');
    if (body.trim().length < 3 || body.trim().length > 500) return setProblem('The message must be 3 to 500 characters.');
    setProblem(''); send.reset(); setConfirming(true);
  };

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">Announcements</h1>
      <Alert tone="info">Announcements appear as in-app notifications for active users. They are recorded in the audit log. No emails or text messages are sent in this demonstration.</Alert>
      <Card>
        <form noValidate onSubmit={review} className="space-y-4">
          {problem && <Alert tone="error">{problem}</Alert>}
          {send.isSuccess && <Alert tone="success">Sent to {send.data.sent} {send.data.sent === 1 ? 'person' : 'people'}.</Alert>}
          {send.isError && <Alert tone="error">{send.error.message}</Alert>}
          <div><label htmlFor="n-aud" className="text-sm font-medium">Send to</label>
            <select id="n-aud" value={audience} onChange={(e) => setAudience(e.target.value as typeof audience)} className="mt-1 block min-h-[44px] w-full rounded-lg border border-navy-900/25 bg-white px-3">{AUDIENCES.map((a) => <option key={a.v} value={a.v}>{a.l}</option>)}</select></div>
          <div><label htmlFor="n-title" className="text-sm font-medium">Title</label><input id="n-title" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} className="mt-1 block min-h-[44px] w-full rounded-lg border border-navy-900/25 px-3" /></div>
          <div><label htmlFor="n-body" className="text-sm font-medium">Message</label><textarea id="n-body" rows={4} value={body} maxLength={500} onChange={(e) => setBody(e.target.value)} className="mt-1 block w-full rounded-lg border border-navy-900/25 p-3" /><p className="mt-1 text-xs text-navy-900/60">{body.length}/500</p></div>
          <Button type="submit">Review and send</Button>
        </form>
      </Card>
      <ConfirmDialog open={confirming} title="Send this announcement?" confirmLabel="Send now" cancelLabel="Back" pending={send.isPending} onCancel={() => setConfirming(false)}
        onConfirm={() => send.mutate({ audience, title: title.trim(), body: body.trim() }, { onSuccess: () => { setTitle(''); setBody(''); }, onSettled: () => setConfirming(false) })}>
        <p><strong>{AUDIENCES.find((a) => a.v === audience)?.l}</strong> will receive “{title.trim()}”. This cannot be recalled.</p>
      </ConfirmDialog>
    </div>
  );
}
