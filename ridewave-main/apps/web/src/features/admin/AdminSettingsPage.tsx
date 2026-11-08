import { useState } from 'react';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { bpToPercentInput, parsePercentToBp } from '../../lib/money';
import { patch, useAdminMutation, useAdminQuery } from './api';

type Values = { driverCommissionBp: number; offerTtlSeconds: number; searchTimeoutSeconds: number; maxPickupRadiusMeters: number };
type Result = { values: Values; overridden: Array<keyof Values> };
type Field = { key: keyof Values; label: string; hint: string; kind: 'percent' | 'int'; min?: number; max?: number };
const FIELDS: Field[] = [
  { key: 'driverCommissionBp', label: 'Driver commission (%)', hint: 'The platform’s share of each fare, 0 to 50. The default (20%) is a demonstration value, not a real rate.', kind: 'percent' },
  { key: 'offerTtlSeconds', label: 'Driver response time (seconds)', hint: 'How long a driver has to accept a request before it goes to the next driver. 10 to 300.', kind: 'int', min: 10, max: 300 },
  { key: 'searchTimeoutSeconds', label: 'Search timeout (seconds)', hint: 'How long to look for a driver before telling the passenger none is available. 10 to 600.', kind: 'int', min: 10, max: 600 },
  { key: 'maxPickupRadiusMeters', label: 'Maximum pickup distance (metres)', hint: 'Drivers farther than this from the pickup are not offered the ride. 1000 to 50000.', kind: 'int', min: 1000, max: 50_000 },
];
const show = (f: Field, v: number) => (f.kind === 'percent' ? bpToPercentInput(v) : String(v));
function parse(f: Field, text: string): number | null {
  if (f.kind === 'percent') return parsePercentToBp(text);
  const n = /^\d{1,6}$/.test(text.trim()) ? Number(text) : NaN;
  return Number.isInteger(n) && n >= (f.min ?? 0) && n <= (f.max ?? Infinity) ? n : null;
}

function Form({ data }: { data: Result }) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(FIELDS.map((f) => [f.key, show(f, data.values[f.key])])));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [info, setInfo] = useState('');
  const save = useAdminMutation((b: Record<string, number>) => patch('/admin/settings', b));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const changes: Record<string, number> = {};
    for (const f of FIELDS) {
      const n = parse(f, values[f.key] ?? '');
      if (n === null) errs[f.key] = f.kind === 'percent' ? 'Enter a percentage from 0 to 50, e.g. 15 or 12.5' : `Enter a whole number from ${f.min} to ${f.max}`;
      else if (n !== data.values[f.key]) changes[f.key] = n;
    }
    setErrors(errs); setInfo('');
    if (Object.keys(errs).length) return;
    if (Object.keys(changes).length === 0) return setInfo('No changes to save.');
    save.mutate(changes);
  };

  return (
    <form noValidate onSubmit={submit} className="space-y-5">
      {FIELDS.map((f) => (
        <div key={f.key}>
          <label htmlFor={`s-${f.key}`} className="text-sm font-medium">{f.label} {data.overridden.includes(f.key) ? <Badge tone="accent">Set by an administrator</Badge> : <Badge>Default</Badge>}</label>
          <input id={`s-${f.key}`} inputMode="decimal" value={values[f.key]} aria-invalid={!!errors[f.key]} aria-describedby={`s-${f.key}-hint`} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} className="mt-1 block min-h-[44px] w-full max-w-xs rounded-lg border border-navy-900/25 px-3 aria-[invalid=true]:border-danger" />
          {errors[f.key] ? <p role="alert" className="mt-1 text-sm text-danger">{errors[f.key]}</p> : <p id={`s-${f.key}-hint`} className="mt-1 text-xs text-navy-900/60">{f.hint}</p>}
        </div>
      ))}
      {info && <Alert tone="info">{info}</Alert>}
      {save.isError && <Alert tone="error">{save.error.message}</Alert>}
      {save.isSuccess && <Alert tone="success">Settings saved and recorded in the audit log. They apply to new activity straight away.</Alert>}
      <Button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save settings'}</Button>
    </form>
  );
}

export function AdminSettingsPage() {
  useDocumentTitle('Platform settings');
  const { data, isLoading, error } = useAdminQuery<Result>(['settings'], '/admin/settings');
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">Platform settings</h1>
      {isLoading && <Skeleton className="h-64" />}
      {error && <Alert tone="error">{error.message}</Alert>}
      {data && <Card><Form key={JSON.stringify(data.values)} data={data} /></Card>}
    </div>
  );
}
