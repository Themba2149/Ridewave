import { useState } from 'react';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Pager } from '../../components/ui/Pager';
import { Skeleton } from '../../components/ui/Skeleton';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatDateTime, formatMinorAsRand } from '../../lib/formatters';
import { qs, useAdminQuery } from './api';
import type { Paged } from './types';

type Row = { id: string; rideId: string; passengerName: string; method: string; status: string; amountMinor: number; provider: string; transactionRef: string | null; failureReason: string | null; createdAt: string };
type Result = Paged<Row> & { summary: { succeededMinor: number; pendingMinor: number; counts: Record<string, number> }; note: string };
const PAGE_SIZE = 10;
const tone = (s: string) => (s === 'SUCCEEDED' ? 'success' : s === 'FAILED' ? 'warning' : 'neutral') as 'success' | 'warning' | 'neutral';

export function AdminPaymentsPage() {
  useDocumentTitle('Payments');
  const [status, setStatus] = useState('');
  const [method, setMethod] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useAdminQuery<Result>(['payments', status, method, page], `/admin/payments${qs({ status, method, page, pageSize: PAGE_SIZE })}`);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Payments</h1>
      <Alert tone="warning">{data?.note ?? 'Payments in this build use a simulated provider. No real money has moved.'}</Alert>
      {data && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="p-4"><p className="text-sm text-navy-900/70">Succeeded (simulated total)</p><p className="mt-1 text-2xl font-bold">{formatMinorAsRand(data.summary.succeededMinor)}</p></Card>
          <Card className="p-4"><p className="text-sm text-navy-900/70">Pending</p><p className="mt-1 text-2xl font-bold">{formatMinorAsRand(data.summary.pendingMinor)}</p></Card>
          <Card className="p-4"><p className="text-sm text-navy-900/70">By status</p><p className="mt-1 text-sm">{Object.entries(data.summary.counts).map(([k, v]) => `${k.toLowerCase()}: ${v}`).join(' · ') || 'No payments yet'}</p></Card>
        </div>
      )}
      <Card>
        <div className="flex flex-wrap gap-3">
          <label className="text-sm font-medium">Status <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="ml-2 min-h-[44px] rounded-lg border border-navy-900/25 bg-white px-3"><option value="">Any</option>{['PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'REFUNDED'].map((s) => <option key={s} value={s}>{s.toLowerCase()}</option>)}</select></label>
          <label className="text-sm font-medium">Method <select value={method} onChange={(e) => { setMethod(e.target.value); setPage(1); }} className="ml-2 min-h-[44px] rounded-lg border border-navy-900/25 bg-white px-3"><option value="">Any</option><option value="CASH">Cash</option><option value="CARD">Card</option><option value="DIGITAL_WALLET">Digital wallet</option></select></label>
        </div>
        {isLoading && <Skeleton className="mt-4 h-40" />}
        {error && <div className="mt-4"><Alert tone="error">{error.message}</Alert></div>}
        {data && data.items.length === 0 && <p className="mt-4 text-navy-900/75">No payments match.</p>}
        {data && data.items.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <caption className="sr-only">Payments</caption>
              <thead><tr className="border-b border-navy-900/15"><th scope="col" className="py-2 pr-3">When</th><th scope="col" className="py-2 pr-3">Passenger</th><th scope="col" className="py-2 pr-3">Method</th><th scope="col" className="py-2 pr-3">Status</th><th scope="col" className="py-2 pr-3 text-right">Amount</th><th scope="col" className="py-2">Reference</th></tr></thead>
              <tbody>
                {data.items.map((p) => (
                  <tr key={p.id} className="border-b border-navy-900/10 align-top">
                    <td className="py-2 pr-3">{formatDateTime(p.createdAt)}</td><td className="py-2 pr-3">{p.passengerName}</td>
                    <td className="py-2 pr-3">{p.method === 'CASH' ? 'Cash' : p.method === 'CARD' ? 'Card' : 'Wallet'}{p.provider === 'dev' && <> <Badge tone="warning">Simulated</Badge></>}</td>
                    <td className="py-2 pr-3"><Badge tone={tone(p.status)}>{p.status}</Badge>{p.failureReason && <span className="block text-xs text-navy-900/70">{p.failureReason}</span>}</td>
                    <td className="py-2 pr-3 text-right">{formatMinorAsRand(p.amountMinor)}</td><td className="py-2 font-mono text-xs">{p.transactionRef ?? '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <Pager page={page} pageSize={PAGE_SIZE} total={data.total} onPage={setPage} />}
        <div className="mt-3"><Button variant="outline" onClick={() => { setStatus(''); setMethod(''); setPage(1); }}>Clear filters</Button></div>
      </Card>
    </div>
  );
}
