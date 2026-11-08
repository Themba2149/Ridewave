import { useState } from 'react';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { bpToInput, minorToInput, parseMoneyToMinor, parseMultiplierToBp } from '../../lib/money';
import { patch, useAdminMutation, useAdminQuery } from './api';
import type { CategoryRow, PricingRow } from './types';

type Field = { key: keyof PricingRow; label: string; kind: 'money' | 'seconds' | 'multiplier'; hint?: string };
const FIELDS: Field[] = [
  { key: 'baseFareMinor', label: 'Base fare (R)', kind: 'money' }, { key: 'perKmMinor', label: 'Per kilometre (R)', kind: 'money' }, { key: 'perMinuteMinor', label: 'Per minute (R)', kind: 'money' },
  { key: 'minimumFareMinor', label: 'Minimum fare (R)', kind: 'money' }, { key: 'bookingFeeMinor', label: 'Booking fee (R)', kind: 'money' }, { key: 'cancellationFeeMinor', label: 'Cancellation fee (R)', kind: 'money' },
  { key: 'freeCancelWindowSeconds', label: 'Free cancellation window (seconds)', kind: 'seconds' },
  { key: 'demandMultiplierBp', label: 'Demand multiplier (×)', kind: 'multiplier', hint: '1.00 means no surge; cannot go below 1.00' },
  { key: 'roundingMinor', label: 'Round fares up to (R)', kind: 'money', hint: 'e.g. 1.00 rounds up to the next rand' },
];
const toInput = (f: Field, row: PricingRow) => (f.kind === 'money' ? minorToInput(row[f.key] as number) : f.kind === 'multiplier' ? bpToInput(row[f.key] as number) : String(row[f.key]));
function parse(f: Field, text: string): number | null {
  if (f.kind === 'money') return parseMoneyToMinor(text);
  if (f.kind === 'multiplier') { const bp = parseMultiplierToBp(text); return bp !== null && bp >= 10_000 ? bp : null; }
  return /^\d{1,4}$/.test(text.trim()) ? Number(text) : null;
}

function PricingCard({ row, category }: { row: PricingRow; category?: CategoryRow }) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(FIELDS.map((f) => [f.key, toInput(f, row)])));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [info, setInfo] = useState('');
  const save = useAdminMutation((body: Record<string, unknown>) => patch('/admin/pricing', body));
  const [cat, setCat] = useState({ name: category?.name ?? '', description: category?.description ?? '', capacity: String(category?.capacity ?? ''), isActive: category?.isActive ?? true });
  const saveCat = useAdminMutation((body: Record<string, unknown>) => patch(`/admin/categories/${category?.id}`, body));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const changes: Record<string, number> = {};
    for (const f of FIELDS) {
      const n = parse(f, values[f.key] ?? '');
      if (n === null) errs[f.key] = f.kind === 'multiplier' ? 'Enter 1.00 or more, e.g. 1.25' : f.kind === 'seconds' ? 'Enter whole seconds' : 'Enter an amount like 12.50';
      else if (n !== row[f.key]) changes[f.key] = n;
    }
    setErrors(errs); setInfo('');
    if (Object.keys(errs).length) return;
    if (Object.keys(changes).length === 0) return setInfo('No changes to save.');
    save.mutate({ categoryCode: row.categoryCode, ...changes });
  };
  const submitCat = (e: React.FormEvent) => {
    e.preventDefault();
    const capacity = Number(cat.capacity);
    if (!category || !Number.isInteger(capacity) || capacity < 1) return;
    saveCat.mutate({ name: cat.name.trim(), description: cat.description.trim(), capacity, isActive: cat.isActive });
  };

  return (
    <Card className="space-y-6">
      <h2 className="text-xl font-bold">{row.categoryName}</h2>
      <form noValidate onSubmit={submit} aria-label={`${row.categoryName} pricing`}>
        <div className="grid gap-4 sm:grid-cols-3">
          {FIELDS.map((f) => {
            const id = `${row.categoryCode}-${f.key}`;
            return (
              <div key={f.key}>
                <label htmlFor={id} className="text-sm font-medium">{f.label}</label>
                <input id={id} inputMode="decimal" value={values[f.key]} aria-invalid={!!errors[f.key]} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} className="mt-1 block min-h-[44px] w-full rounded-lg border border-navy-900/25 px-3 aria-[invalid=true]:border-danger" />
                {errors[f.key] ? <p role="alert" className="mt-1 text-sm text-danger">{errors[f.key]}</p> : f.hint && <p className="mt-1 text-xs text-navy-900/60">{f.hint}</p>}
              </div>
            );
          })}
        </div>
        <div className="mt-4 space-y-3">
          {info && <Alert tone="info">{info}</Alert>}
          {save.isError && <Alert tone="error">{save.error.message}</Alert>}
          {save.isSuccess && <Alert tone="success">Pricing saved. New estimates use it straight away, and the change is in the audit log.</Alert>}
          <Button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save pricing'}</Button>
        </div>
      </form>

      {category && (
        <form noValidate onSubmit={submitCat} aria-label={`${row.categoryName} settings`} className="border-t border-navy-900/10 pt-4">
          <h3 className="font-semibold">Category settings</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <div><label htmlFor={`${category.id}-name`} className="text-sm font-medium">Name</label><input id={`${category.id}-name`} value={cat.name} onChange={(e) => setCat({ ...cat, name: e.target.value })} className="mt-1 block min-h-[44px] w-full rounded-lg border border-navy-900/25 px-3" /></div>
            <div><label htmlFor={`${category.id}-cap`} className="text-sm font-medium">Seats required</label><input id={`${category.id}-cap`} inputMode="numeric" value={cat.capacity} onChange={(e) => setCat({ ...cat, capacity: e.target.value })} className="mt-1 block min-h-[44px] w-full rounded-lg border border-navy-900/25 px-3" /></div>
            <label className="flex min-h-[44px] items-end gap-2 pb-2"><input type="checkbox" checked={cat.isActive} onChange={(e) => setCat({ ...cat, isActive: e.target.checked })} className="h-5 w-5" /> Available to passengers</label>
          </div>
          <div className="mt-3"><label htmlFor={`${category.id}-desc`} className="text-sm font-medium">Description</label><input id={`${category.id}-desc`} value={cat.description} onChange={(e) => setCat({ ...cat, description: e.target.value })} className="mt-1 block min-h-[44px] w-full rounded-lg border border-navy-900/25 px-3" /></div>
          <div className="mt-3 space-y-3">
            {saveCat.isError && <Alert tone="error">{saveCat.error.message}</Alert>}
            {saveCat.isSuccess && <Alert tone="success">Category saved.</Alert>}
            <Button type="submit" variant="outline" disabled={saveCat.isPending}>Save category</Button>
          </div>
        </form>
      )}
    </Card>
  );
}

export function AdminPricingPage() {
  useDocumentTitle('Pricing');
  const pricing = useAdminQuery<{ items: PricingRow[] }>(['pricing'], '/admin/pricing');
  const categories = useAdminQuery<{ items: CategoryRow[] }>(['categories'], '/admin/categories');
  return (
    <div className="max-w-5xl space-y-6">
      <h1 className="text-3xl font-bold">Pricing and categories</h1>
      <Alert tone="warning">These are demonstration rates for testing, not official or market-verified prices. Fares are calculated on the server in whole cents and rounded up to the step below. Changes apply to new estimates only; existing rides keep their fare.</Alert>
      {pricing.isLoading && <Skeleton className="h-64" />}
      {pricing.error && <Alert tone="error">{pricing.error.message}</Alert>}
      {pricing.data?.items.map((row) => <PricingCard key={`${row.id}-${JSON.stringify(row)}`} row={row} category={categories.data?.items.find((c) => c.code === row.categoryCode)} />)}
    </div>
  );
}
