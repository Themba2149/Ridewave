import { Link } from 'react-router-dom';
import { Alert } from '../../components/ui/Alert';
import { ButtonLink } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { RideStatusBadge } from '../../components/ui/RideStatusBadge';
import { Skeleton } from '../../components/ui/Skeleton';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatDateTime, formatMinorAsRand } from '../../lib/formatters';
import { useCurrentUser } from '../auth/useAuth';
import { useMyRides, useSavedLocations } from '../rides/api';

export function PassengerHome() {
  useDocumentTitle('Passenger dashboard');
  const { data: user } = useCurrentUser();
  const active = useMyRides('active', 1, 1);
  const past = useMyRides('past', 1, 5);
  const saved = useSavedLocations();
  const current = active.data?.items[0];

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Welcome, {user?.fullName.split(' ')[0]}</h1>
        {!current && <ButtonLink to="/passenger/book">Book a ride</ButtonLink>}
      </div>

      <Card>
        <h2 className="text-lg font-bold">Current ride</h2>
        {active.isLoading ? <Skeleton className="mt-3 h-16" /> : current ? (
          <Link to={`/passenger/rides/${current.id}`} className="mt-3 block rounded-lg border border-navy-900/15 p-3 hover:border-navy-900/40">
            <RideStatusBadge status={current.status} />
            <p className="mt-2 font-semibold">{current.pickupAddress}</p><p className="text-sm text-navy-900/75">to {current.dropoffAddress}</p>
          </Link>
        ) : <p className="mt-2 text-navy-900/75">No active ride. Where would you like to go?</p>}
      </Card>

      <Card>
        <div className="flex items-center justify-between"><h2 className="text-lg font-bold">Recent rides</h2><Link className="text-sm font-semibold underline" to="/passenger/rides">View all</Link></div>
        {past.isLoading ? <Skeleton className="mt-3 h-24" /> : past.data && past.data.items.length > 0 ? (
          <ul className="mt-3 divide-y divide-navy-900/10">
            {past.data.items.map((r) => (
              <li key={r.id}><Link to={`/passenger/rides/${r.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 hover:underline">
                <span><span className="block font-medium">{r.pickupAddress} → {r.dropoffAddress}</span><span className="text-xs text-navy-900/70">{formatDateTime(r.requestedAt)} · {r.finalFareMinor !== null ? formatMinorAsRand(r.finalFareMinor) : r.status === 'CANCELLED' ? 'No charge' : formatMinorAsRand(r.estimatedFareMinor)}</span></span>
                <RideStatusBadge status={r.status} />
              </Link></li>
            ))}
          </ul>
        ) : <p className="mt-2 text-navy-900/75">Your completed and cancelled rides will appear here.</p>}
      </Card>

      <Card>
        <div className="flex items-center justify-between"><h2 className="text-lg font-bold">Saved places</h2><Link className="text-sm font-semibold underline" to="/passenger/places">Manage</Link></div>
        {saved.data && saved.data.length > 0
          ? <ul className="mt-3 space-y-1">{saved.data.slice(0, 4).map((s) => <li key={s.id}><span className="font-medium">{s.label}</span> <span className="text-sm text-navy-900/70">· {s.address}</span></li>)}</ul>
          : <p className="mt-2 text-navy-900/75">Save Home, Work and other favourites for faster booking.</p>}
      </Card>

      <Alert tone="info">Scheduled rides, payment methods and notifications are added in later build phases.</Alert>
    </div>
  );
}
