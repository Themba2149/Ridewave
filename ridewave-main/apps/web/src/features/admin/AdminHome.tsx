import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { RideStatusBadge } from '../../components/ui/RideStatusBadge';
import { Skeleton } from '../../components/ui/Skeleton';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatDateTime, formatMinorAsRand } from '../../lib/formatters';
import { qs, useAdminQuery } from './api';
import type { Analytics } from './types';

const VolumeChart = lazy(() => import('./VolumeChart'));

function Metric({ label, value, to, hint }: { label: string; value: string | number; to?: string; hint?: string }) {
  const body = <><p className="text-sm text-navy-900/70">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p>{hint && <p className="mt-1 text-xs text-navy-900/60">{hint}</p>}</>;
  return <Card className="p-4">{to ? <Link to={to} className="block hover:underline">{body}</Link> : body}</Card>;
}

export function AdminHome() {
  useDocumentTitle('Admin dashboard');
  const [days, setDays] = useState(14);
  const { data, isLoading, error } = useAdminQuery<Analytics>(['analytics', days], `/admin/analytics${qs({ days })}`);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Administrator dashboard</h1>
        <label className="flex items-center gap-2 text-sm font-medium">Period
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="min-h-[44px] rounded-lg border border-navy-900/25 bg-white px-3">
            <option value={7}>Last 7 days</option><option value={14}>Last 14 days</option><option value={30}>Last 30 days</option>
          </select>
        </label>
      </div>
      {isLoading && <Skeleton className="h-64" />}
      {error && <Alert tone="error">{error.message}</Alert>}
      {data && (
        <>
          <section aria-label="Key figures" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Metric label="Registered users" value={data.overview.totalUsers} to="/admin/users" />
            <Metric label="Passengers" value={data.overview.passengers} to="/admin/users?role=PASSENGER" />
            <Metric label="Drivers" value={data.overview.drivers} to="/admin/drivers" />
            <Metric label="Pending driver approvals" value={data.overview.pendingDriverApprovals} to="/admin/drivers?approval=PENDING" />
            <Metric label="Active rides" value={data.overview.activeRides} to="/admin/rides" />
            <Metric label="Completed rides" value={data.overview.completedRides} />
            <Metric label="Cancelled rides" value={data.overview.cancelledRides} />
            <Metric label="Fares from completed rides" value={formatMinorAsRand(data.overview.revenueMinor)} hint="Not money received: payments arrive in a later phase." />
          </section>

          <Card>
            <h2 className="text-lg font-bold">Ride volume, last {data.days} days</h2>
            <Suspense fallback={<Skeleton className="mt-3 h-64" />}><VolumeChart data={data.volume} /></Suspense>
            <p className="mt-2 text-xs text-navy-900/70">{data.notes.volume}</p>
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-semibold">View as a table</summary>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[420px] text-sm">
                  <caption className="sr-only">Daily ride volume and fares</caption>
                  <thead><tr className="border-b border-navy-900/15 text-left"><th scope="col" className="py-1">Date</th><th scope="col" className="py-1 text-right">Requested</th><th scope="col" className="py-1 text-right">Completed</th><th scope="col" className="py-1 text-right">Cancelled</th><th scope="col" className="py-1 text-right">Fares</th></tr></thead>
                  <tbody>{data.volume.map((d) => <tr key={d.date} className="border-b border-navy-900/10"><th scope="row" className="py-1 text-left font-normal">{d.date}</th><td className="py-1 text-right">{d.requested}</td><td className="py-1 text-right">{d.completed}</td><td className="py-1 text-right">{d.cancelled}</td><td className="py-1 text-right">{formatMinorAsRand(d.revenueMinor)}</td></tr>)}</tbody>
                </table>
              </div>
            </details>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <div className="flex items-center justify-between"><h2 className="text-lg font-bold">Recent bookings</h2><Link to="/admin/rides" className="text-sm font-semibold underline">All rides</Link></div>
              {data.recentRides.length === 0 ? <p className="mt-3 text-navy-900/75">No rides yet.</p> : (
                <ul className="mt-3 divide-y divide-navy-900/10">
                  {data.recentRides.map((r) => (
                    <li key={r.id} className="py-2 text-sm">
                      <div className="flex items-center justify-between gap-2"><span className="font-medium">{r.passengerName}</span><RideStatusBadge status={r.status} /></div>
                      <p className="text-navy-900/75">{r.pickupAddress} → {r.dropoffAddress}</p>
                      <p className="text-xs text-navy-900/60">{formatDateTime(r.requestedAt)} · {r.categoryName}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card>
              <h2 className="text-lg font-bold">Driver performance</h2>
              {data.topDrivers.length === 0 ? <p className="mt-3 text-navy-900/75">No completed trips yet.</p> : (
                <table className="mt-3 w-full text-sm">
                  <caption className="sr-only">Drivers ranked by fares from completed trips</caption>
                  <thead><tr className="border-b border-navy-900/15 text-left"><th scope="col" className="py-1">Driver</th><th scope="col" className="py-1 text-right">Trips</th><th scope="col" className="py-1 text-right">Fares</th><th scope="col" className="py-1 text-right">Rating</th></tr></thead>
                  <tbody>{data.topDrivers.map((d) => <tr key={d.driverId} className="border-b border-navy-900/10"><th scope="row" className="py-1 text-left font-normal"><Link to={`/admin/drivers/${d.driverId}`} className="underline">{d.name}</Link>{d.isOnline && <> <Badge tone="success">Online</Badge></>}</th><td className="py-1 text-right">{d.completedTrips}</td><td className="py-1 text-right">{formatMinorAsRand(d.grossMinor)}</td><td className="py-1 text-right">{d.ratingCount ? d.ratingAverage.toFixed(1) : '–'}</td></tr>)}</tbody>
                </table>
              )}
            </Card>
          </div>
          <p className="text-xs text-navy-900/60">{data.notes.revenue}</p>
        </>
      )}
    </div>
  );
}
