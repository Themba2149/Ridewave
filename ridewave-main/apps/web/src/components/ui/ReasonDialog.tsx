import { useEffect, useState, type ReactNode } from 'react';
import { ConfirmDialog } from './ConfirmDialog';

type Props = { open: boolean; title: string; confirmLabel: string; label?: string; required?: boolean; pending?: boolean; error?: string; children?: ReactNode; onConfirm: (reason: string) => void; onCancel: () => void };

/** Confirmation dialog that also collects a reason (kept for the audit log). */
export function ReasonDialog({ open, title, confirmLabel, label = 'Reason', required = false, pending, error, children, onConfirm, onCancel }: Props) {
  const [reason, setReason] = useState('');
  const [local, setLocal] = useState('');
  useEffect(() => { if (open) { setReason(''); setLocal(''); } }, [open]);
  const submit = () => {
    if (required && reason.trim().length < 3) return setLocal('Please give a reason (at least 3 characters).');
    onConfirm(reason.trim());
  };
  return (
    <ConfirmDialog open={open} title={title} confirmLabel={confirmLabel} cancelLabel="Cancel" pending={pending} onConfirm={submit} onCancel={onCancel}>
      {children}
      <label htmlFor="reason-text" className="mt-3 block text-sm font-medium">{label}{required ? '' : ' (optional)'}</label>
      <textarea id="reason-text" rows={3} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} aria-invalid={!!local} className="mt-1 block w-full rounded-lg border border-navy-900/25 p-3" />
      {(local || error) && <p role="alert" className="mt-1 text-sm text-danger">{local || error}</p>}
    </ConfirmDialog>
  );
}
