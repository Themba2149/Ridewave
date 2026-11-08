import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from './Button';

type Props = { open: boolean; title: string; children: ReactNode; confirmLabel: string; cancelLabel?: string; pending?: boolean; onConfirm: () => void; onCancel: () => void };

/** Accessible modal built on the native <dialog>: focus is trapped, Escape closes it, and the page behind is inert. */
export function ConfirmDialog({ open, title, children, confirmLabel, cancelLabel = 'Keep it', pending, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog ref={ref} aria-labelledby="confirm-title" onCancel={(e) => { e.preventDefault(); onCancel(); }} className="w-[min(92vw,28rem)] rounded-xl2 p-0 shadow-card backdrop:bg-navy-900/60">
      <div className="p-6">
        <h2 id="confirm-title" className="text-xl font-bold">{title}</h2>
        <div className="mt-3 text-navy-900/80">{children}</div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel} disabled={pending}>{cancelLabel}</Button>
          <button type="button" onClick={onConfirm} disabled={pending} className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-danger px-5 py-2.5 font-semibold text-white hover:bg-red-700 disabled:opacity-60">
            {pending ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
