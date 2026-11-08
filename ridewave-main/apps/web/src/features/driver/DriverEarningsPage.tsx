import { useState } from 'react';
import { Alert } from '../../components/ui/Alert';
import { Card } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatMinorAsRand } from '../../lib/formatters';
import { useDriverEarnings } from './api';

const PERIODS = [{ id: 'day', label: 'Today' }, { id: 'week', label: 'This week' }, { id: 'month', label: 'This month' }] as const;

export function DriverEarningsPage() {
  useDocumentTitle('Earnings');
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('week');
  const { data, isLoading, error } = useDriverEarnings(period);
  const max = Math.max(1, ...(data?.daily.map((d) => d.netMinor) ?? [1]));

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold">Earnings</h1>
      <div role="group" aria-label="Period" className="flex gap-2">
        {PERIODS.map((p) => (
          <button key={p.id} type="button" aria-pressed={period === p.id} onClick={() => setPeriod(p.id)}
            className={`min-h-[44px] rounded-lg border px-4 text-sm font-semibold ${period === p.id ? 'border-navy-900 bg-navy-900 text-ink' : 'border-navy-900/25'}`}>{p.label}</button>
        ))}
      </div>
      {isLoading && <Skeleton className="h-48" />}
      {error && <Alert tone="error">{error.message}</Alert>}
      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            <Card><p className="text-sm text-navy-900/70">Trips</p><p className="text-2xl font-bold">{data.trips}</p></Card>
            <Card><p className="text-sm text-navy-900/70">Fares collected</p><p className="text-2xl font-bold">{formatMinorAsRand(data.grossMinor)}</p></Card>
            <Card><p className="text-sm text-navy-900/70">Commission ({data.commission.rateBp / 100}%)</p><p className="text-2xl font-bold">{formatMinorAsRand(data.commissionMinor)}</p></Card>
            <Card><p className="text-sm text-navy-900/70">Your earnings</p><p className="text-2xl font-bold">{formatMinorAsRand(data.netMinor)}</p></Card>
          </div>
          {data.commission.isDemonstrationRate && <p className="text-xs text-navy-900/70">The commission rate is a demonstration value, not a real RideWave rate.</p>}

          {data.daily.length > 1 && (
            <Card>
              <h2 className="text-lg font-bold">Earnings by day</h2>
              <ul aria-hidden className="mt-4 flex h-32 items-end gap-2">
                {data.daily.map((d) => <li key={d.date} className="flex-1 rounded-t bg-accent" style={{ height: `${Math.max(4, (d.netMinor / max) * 100)}%` }} />)}
              </ul>
              <table className="mt-4 w-full text-sm">
                <caption className="sr-only">Earnings by day</caption>
                <thead><tr className="border-b border-navy-900/15 text-left"><th scope="col" className="py-2">Date</th><th scope="col" className="py-2 text-right">Trips</th><th scope="col" className="py-2 text-right">Your earnings</th></tr></thead>
                <tbody>{data.daily.map((d) => <tr key={d.date} className="border-b border-navy-900/10"><th scope="row" className="py-2 text-left font-normal">{d.date}</th><td className="py-2 text-right">{d.trips}</td><td className="py-2 text-right">{formatMinorAsRand(d.netMinor)}</td></tr>)}</tbody>
              </table>
            </Card>
          )}

          <Card>
            <h2 className="text-lg font-bold">Statistics</h2>
            <dl className="mt-3 grid grid-cols-[auto,1fr] gap-x-6 gap-y-1 text-sm">
              <dt className="text-navy-900/70">Completed trips (all time)</dt><dd>{data.stats.completedTripsAllTime}</dd>
              <dt className="text-navy-900/70">Requests accepted</dt><dd>{data.stats.offersAccepted}</dd>
              <dt className="text-navy-900/70">Requests declined</dt><dd>{data.stats.offersDeclined}</dd>
              <dt className="text-navy-900/70">Acceptance rate</dt><dd>{data.stats.acceptanceRatePercent === null ? 'Not enough data yet' : `${data.stats.acceptanceRatePercent}%`}</dd>
            </dl>
          </Card>
        </>
      )}
    </div>
  );
}
