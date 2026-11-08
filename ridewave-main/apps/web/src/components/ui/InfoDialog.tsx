import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from './Button';

/** Read-only modal built on the native <dialog> (focus trap, Escape to close). */
export function InfoDialog({ open, title, children, onClose }: { open: boolean; title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} aria-labelledby="info-title" onCancel={(e) => { e.preventDefault(); onClose(); }} className="w-[min(94vw,40rem)] max-h-[90vh] overflow-auto rounded-xl2 p-0 shadow-card backdrop:bg-navy-900/60">
      <div className="p-6">
        <h2 id="info-title" className="text-xl font-bold">{title}</h2>
        <div className="mt-3">{children}</div>
        <div className="mt-6 flex justify-end"><Button variant="outline" onClick={onClose}>Close</Button></div>
      </div>
    </dialog>
  );
}
