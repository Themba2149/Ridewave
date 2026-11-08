import { zodResolver } from '@hookform/resolvers/zod';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { TextField } from '../../components/forms/TextField';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Skeleton } from '../../components/ui/Skeleton';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useAddPaymentMethod, useDefaultPaymentMethod, usePaymentMethods, useRemovePaymentMethod, type PaymentMethod } from './api';

export const methodSchema = z
  .object({ type: z.enum(['CARD', 'DIGITAL_WALLET']), label: z.string().trim().min(1, 'Give it a name').max(40), last4: z.string().trim().optional() })
  .superRefine((v, ctx) => {
    if (v.type === 'CARD' && !/^\d{4}$/.test(v.last4 ?? '')) ctx.addIssue({ code: 'custom', path: ['last4'], message: 'Enter only the last 4 digits. Never enter the full card number.' });
  });
type Values = z.infer<typeof methodSchema>;

export function PaymentMethodsPage() {
  useDocumentTitle('Payment methods');
  const methods = usePaymentMethods();
  const add = useAddPaymentMethod();
  const remove = useRemovePaymentMethod();
  const makeDefault = useDefaultPaymentMethod();
  const [toDelete, setToDelete] = useState<PaymentMethod | null>(null);
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<Values>({ resolver: zodResolver(methodSchema), defaultValues: { type: 'CARD' } });
  const type = watch('type');

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold">Payment methods</h1>
      <Alert tone="warning">This is a demonstration. Payments are simulated and no real money moves. Only a name and the last 4 digits of a card are stored, never the full number or security code. Use a card ending <strong>0002</strong> to see a declined payment, or <strong>0005</strong> to see a pending one.</Alert>

      <Card>
        <h2 className="text-lg font-bold">Your methods</h2>
        <p className="mt-1 text-sm text-navy-900/70">Cash is always available when you pay for a ride.</p>
        {methods.isLoading && <Skeleton className="mt-3 h-20" />}
        {methods.error && <div className="mt-3"><Alert tone="error">{methods.error.message}</Alert></div>}
        {methods.data && methods.data.length === 0 && <p className="mt-3 text-navy-900/75">No saved methods yet.</p>}
        <ul className="mt-3 divide-y divide-navy-900/10">
          {methods.data?.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <p className="font-medium">{m.label}{m.last4 ? ` •••• ${m.last4}` : ''} <span className="text-sm font-normal text-navy-900/70">({m.type === 'CARD' ? 'Card' : 'Digital wallet'})</span>{m.isDefault && <> <Badge tone="accent">Default</Badge></>}</p>
              <div className="flex gap-2">
                {!m.isDefault && <Button variant="outline" className="!min-h-[36px] !py-1" disabled={makeDefault.isPending} onClick={() => makeDefault.mutate(m.id)}>Make default<span className="sr-only"> {m.label}</span></Button>}
                <button type="button" onClick={() => setToDelete(m)} aria-label={`Delete ${m.label}`} className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-danger hover:bg-danger/10"><Trash2 aria-hidden className="h-5 w-5" /></button>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="text-lg font-bold">Add a method</h2>
        <form noValidate onSubmit={handleSubmit((v) => add.mutate({ type: v.type, label: v.label, ...(v.type === 'CARD' ? { last4: v.last4 } : {}) }, { onSuccess: () => reset({ type: v.type, label: '', last4: '' }) }))} className="mt-3 space-y-4">
          {add.isError && <Alert tone="error">{add.error.message}</Alert>}
          {add.isSuccess && <Alert tone="success">Saved.</Alert>}
          <div>
            <label htmlFor="pm-type" className="text-sm font-medium">Type</label>
            <select id="pm-type" className="mt-1 block min-h-[44px] w-full rounded-lg border border-navy-900/25 bg-white px-3" {...register('type')}><option value="CARD">Card (simulated)</option><option value="DIGITAL_WALLET">Digital wallet (simulated)</option></select>
          </div>
          <TextField label="Name" placeholder={type === 'CARD' ? 'e.g. Personal Visa' : 'e.g. My wallet'} error={errors.label?.message} {...register('label')} />
          {type === 'CARD' && <TextField label="Last 4 digits of the card" inputMode="numeric" maxLength={4} autoComplete="off" hint="Only these 4 digits are stored." error={errors.last4?.message} {...register('last4')} />}
          <Button type="submit" disabled={add.isPending}>{add.isPending ? 'Saving…' : 'Save method'}</Button>
        </form>
      </Card>

      <ConfirmDialog open={!!toDelete} title="Delete this payment method?" confirmLabel="Delete" cancelLabel="Keep it" pending={remove.isPending}
        onCancel={() => setToDelete(null)} onConfirm={() => toDelete && remove.mutate(toDelete.id, { onSettled: () => setToDelete(null) })}>
        <p>{toDelete?.label} will be removed. Past payments are not affected.</p>
      </ConfirmDialog>
    </div>
  );
}
