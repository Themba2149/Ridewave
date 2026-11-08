import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ReasonDialog } from '../../components/ui/ReasonDialog';
import { Skeleton } from '../../components/ui/Skeleton';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatDateTime } from '../../lib/formatters';
import { patch, useAdminMutation, useAdminQuery } from './api';
import { approvalTone } from './AdminDriversPage';
import type { AdminDriverDetail } from './types';

const DOC_LABEL: Record<string, string> = { DRIVERS_LICENCE: 'Driver’s licence', ID_DOCUMENT: 'ID document', PROOF_OF_ADDRESS: 'Proof of address', VEHICLE_REGISTRATION: 'Vehicle registration', VEHICLE_INSURANCE: 'Vehicle insurance', PROFILE_PHOTO: 'Profile photo' };
type Pending = { kind: 'approval'; status: 'APPROVED' | 'REJECTED' | 'SUSPENDED' } | { kind: 'document'; id: string; label: string; status: 'ACCEPTED' | 'REJECTED' };

export function AdminDriverDetailPage() {
  const { driverId = '' } = useParams();
  useDocumentTitle('Review driver');
  const { data, isLoading, error } = useAdminQuery<{ driver: AdminDriverDetail }>(['driver', driverId], `/admin/drivers/${driverId}`);
  const [pending, setPending] = useState<Pending | null>(null);
  const approve = useAdminMutation((v: { status: string; note?: string }) => patch(`/admin/drivers/${driverId}/approval`, v));
  const review = useAdminMutation((v: { id: string; status: string; note?: string }) => patch(`/admin/documents/${v.id}`, { status: v.status, ...(v.note ? { note: v.note } : {}) }));
  const mutation = pending?.kind === 'document' ? review : approve;

  if (isLoading) return <Skeleton className="h-64 max-w-3xl" />;
  if (error || !data) return <Alert tone="error">{error?.message ?? 'Driver not found.'}</Alert>;
  const d = data.driver;

  const confirm = (note: string) => {
    if (!pending) return;
    const done = { onSettled: () => setPending(null) };
    if (pending.kind === 'approval') approve.mutate({ status: pending.status, ...(note ? { note } : {}) }, done);
    else review.mutate({ id: pending.id, status: pending.status, ...(note ? { note } : {}) }, done);
  };
  const needsReason = pending?.status === 'REJECTED' || pending?.status === 'SUSPENDED';

  return (
    <div className="max-w-4xl space-y-6">
      <p><Link to="/admin/drivers" className="text-sm font-semibold underline">← All drivers</Link></p>
      <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-bold">{d.fullName}</h1><Badge tone={approvalTone(d.approvalStatus)}>{d.approvalStatus}</Badge></div>
      {(approve.isError || review.isError) && <Alert tone="error">{(approve.error ?? review.error)?.message}</Alert>}
      {(approve.isSuccess || review.isSuccess) && <Alert tone="success">Saved and recorded in the audit log.</Alert>}

      <Card>
        <h2 className="text-lg font-bold">Application</h2>
        <dl className="mt-3 grid grid-cols-[auto,1fr] gap-x-6 gap-y-1 text-sm">
          <dt className="text-navy-900/70">Email</dt><dd>{d.email}</dd><dt className="text-navy-900/70">Phone</dt><dd>{d.phone ?? 'Not provided'}</dd>
          <dt className="text-navy-900/70">Online now</dt><dd>{d.isOnline ? 'Yes' : 'No'}</dd>
          <dt className="text-navy-900/70">Rating</dt><dd>{d.ratingCount ? `${d.ratingAverage.toFixed(1)} (${d.ratingCount})` : 'No ratings yet'}</dd>
          {d.approvalNote && <><dt className="text-navy-900/70">Last note</dt><dd>{d.approvalNote}</dd></>}
        </dl>
        <div className="mt-4 flex flex-wrap gap-3">
          {d.approvalStatus !== 'APPROVED' && <Button onClick={() => { approve.reset(); setPending({ kind: 'approval', status: 'APPROVED' }); }}>Approve</Button>}
          {d.approvalStatus !== 'REJECTED' && <Button variant="outline" onClick={() => { approve.reset(); setPending({ kind: 'approval', status: 'REJECTED' }); }}>Reject</Button>}
          {d.approvalStatus === 'APPROVED' && <Button variant="outline" onClick={() => { approve.reset(); setPending({ kind: 'approval', status: 'SUSPENDED' }); }}>Suspend</Button>}
        </div>
        <p className="mt-3 text-xs text-navy-900/70">Approval in this demonstration is a manual decision by an administrator. RideWave does not verify identity or legal documents automatically.</p>
      </Card>

      <Card>
        <h2 className="text-lg font-bold">Vehicles</h2>
        {d.vehicles.length === 0 ? <p className="mt-2 text-navy-900/75">No vehicle registered.</p> : (
          <ul className="mt-2 space-y-1 text-sm">{d.vehicles.map((v) => <li key={v.id}>{v.year} {v.make} {v.model}, {v.colour} · <span className="font-mono font-semibold">{v.registration}</span> · {v.categoryName} · {v.passengerCapacity} seats {!v.isActive && <Badge tone="warning">Inactive</Badge>}</li>)}</ul>
        )}
      </Card>

      <Card>
        <h2 className="text-lg font-bold">Documents</h2>
        <p className="text-xs text-navy-900/70">Private files. Every time you open one it is recorded in the audit log.</p>
        {d.documents.length === 0 ? <p className="mt-2 text-navy-900/75">No documents submitted yet.</p> : (
          <ul className="mt-3 divide-y divide-navy-900/10">
            {d.documents.map((doc) => (
              <li key={doc.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div><p className="font-medium">{DOC_LABEL[doc.type] ?? doc.type} <Badge tone={doc.status === 'ACCEPTED' ? 'success' : doc.status === 'REJECTED' ? 'warning' : 'neutral'}>{doc.status}</Badge></p>
                  <p className="text-xs text-navy-900/70">{doc.originalName} · {Math.max(1, Math.round(doc.sizeBytes / 1024))} KB · uploaded {formatDateTime(doc.createdAt)}</p>
                  {doc.reviewNote && <p className="text-xs">Note: {doc.reviewNote}</p>}</div>
                <div className="flex flex-wrap gap-2">
                  <a className="inline-flex min-h-[36px] items-center rounded-lg border border-navy-900/25 px-3 text-sm font-semibold hover:bg-navy-900/5" href={`/api/v1/admin/documents/${doc.id}/download`}>Open<span className="sr-only"> {DOC_LABEL[doc.type] ?? doc.type}</span></a>
                  {doc.status !== 'ACCEPTED' && <Button variant="outline" className="!min-h-[36px] !py-1" onClick={() => { review.reset(); setPending({ kind: 'document', id: doc.id, label: DOC_LABEL[doc.type] ?? doc.type, status: 'ACCEPTED' }); }}>Accept<span className="sr-only"> {DOC_LABEL[doc.type] ?? doc.type}</span></Button>}
                  {doc.status !== 'REJECTED' && <Button variant="outline" className="!min-h-[36px] !py-1" onClick={() => { review.reset(); setPending({ kind: 'document', id: doc.id, label: DOC_LABEL[doc.type] ?? doc.type, status: 'REJECTED' }); }}>Reject<span className="sr-only"> {DOC_LABEL[doc.type] ?? doc.type}</span></Button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ReasonDialog open={!!pending} required={needsReason} label={needsReason ? 'Reason (shown to the driver)' : 'Note'} confirmLabel={pending ? `${pending.status === 'APPROVED' || pending.status === 'ACCEPTED' ? 'Confirm' : 'Yes,'} ${pending.status.toLowerCase()}` : 'Confirm'}
        title={pending?.kind === 'document' ? `${pending.status === 'ACCEPTED' ? 'Accept' : 'Reject'} ${pending.label}?` : pending ? `${pending.status === 'APPROVED' ? 'Approve' : pending.status === 'REJECTED' ? 'Reject' : 'Suspend'} this driver?` : ''}
        pending={mutation.isPending} onCancel={() => setPending(null)} onConfirm={confirm}>
        <p>{pending?.kind === 'approval' && pending.status === 'APPROVED' ? 'The driver will be able to go online and receive rides.' : pending?.kind === 'approval' ? 'The driver will be taken offline and will not receive rides.' : 'The driver will see this decision.'}</p>
      </ReasonDialog>
    </div>
  );
}
