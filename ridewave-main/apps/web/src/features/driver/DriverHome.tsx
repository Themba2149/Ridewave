import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RoutePreview } from '../../components/maps/RoutePreview';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { RideStatusBadge } from '../../components/ui/RideStatusBadge';
import { Skeleton } from '../../components/ui/Skeleton';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatDistance, formatDuration, formatMinorAsRand } from '../../lib/formatters';
import { usePlaceSearch, useRide } from '../rides/api';
import { useDriverEarnings, useDriverMe, useDriverRequests, useDriverRides, useRideAction, useSetAvailability, type RideOffer } from './api';

function useSecondsLeft(iso: string | null | undefined) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  return iso ? Math.max(0, Math.round((new Date(iso).getTime() - now) / 1000)) : 0;
}

function OfferCard({ offer }: { offer: RideOffer }) {
  const action = useRideAction();
  const left = useSecondsLeft(offer.offerExpiresAt);
  return (
    <Card className="space-y-3 border-accent-dark/60">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">New ride request</h2>
        <Badge tone={left > 0 ? 'accent' : 'warning'}>{left > 0 ? `Respond within ${left}s` : 'Expiring'}</Badge>
      </div>
      <RoutePreview pickup={offer.pickup} dropoff={offer.dropoff} />
      <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-navy-900/70">Passenger</dt><dd>{offer.passengerFirstName}</dd>
        <dt className="text-navy-900/70">Pickup</dt><dd>{offer.pickup.address}{offer.pickupEtaSeconds !== null && ` (about ${formatDuration(offer.pickupEtaSeconds)} away, estimate)`}</dd>
        <dt className="text-navy-900/70">Destination</dt><dd>{offer.dropoff.address}</dd>
        <dt className="text-navy-900/70">Trip</dt><dd>{formatDistance(offer.distanceMeters)} · about {formatDuration(offer.durationSeconds)}</dd>
        <dt className="text-navy-900/70">Fare (estimate)</dt><dd>{formatMinorAsRand(offer.estimatedFareMinor)} · your share about {formatMinorAsRand(offer.estimatedEarningsMinor)}</dd>
      </dl>
      {action.isError && <Alert tone="error">{action.error.message}</Alert>}
      <div className="flex gap-3">
        <Button onClick={() => action.mutate({ rideId: offer.rideId, action: 'accept' })} disabled={action.isPending}>Accept</Button>
        <Button variant="outline" onClick={() => action.mutate({ rideId: offer.rideId, action: 'decline' })} disabled={action.isPending}>Decline</Button>
      </div>
    </Card>
  );
}

const NEXT: Record<string, { label: string; action: 'arrive' | 'start' | 'complete'; note: string } | undefined> = {
  DRIVER_ARRIVING: { label: 'I have arrived at the pickup', action: 'arrive', note: 'Head to the pickup point.' },
  DRIVER_ARRIVED: { label: 'Start trip', action: 'start', note: 'Start once the passenger is in the vehicle.' },
  IN_PROGRESS: { label: 'Complete trip', action: 'complete', note: 'Complete when you reach the destination.' },
};

function ActiveRide({ rideId }: { rideId: string }) {
  const { data: ride } = useRide(rideId);
  const action = useRideAction();
  const [confirming, setConfirming] = useState(false);
  if (!ride) return <Skeleton className="h-40" />;
  const next = NEXT[ride.status];
  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-bold">Current trip</h2><RideStatusBadge status={ride.status} /></div>
      <RoutePreview pickup={ride.pickup} dropoff={ride.dropoff} />
      <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-navy-900/70">Passenger</dt><dd>{ride.passengerFirstName}</dd>
        <dt className="text-navy-900/70">Pickup</dt><dd>{ride.pickup.address}</dd>
        <dt className="text-navy-900/70">Destination</dt><dd>{ride.dropoff.address}</dd>
        <dt className="text-navy-900/70">Estimated fare</dt><dd>{formatMinorAsRand(ride.estimatedFareMinor)}</dd>
      </dl>
      {ride.status === 'CANCELLED' && <Alert tone="info">The passenger cancelled this trip.</Alert>}
      {action.isError && <Alert tone="error">{action.error.message}</Alert>}
      {next && (
        <div>
          <p className="mb-2 text-sm text-navy-900/75">{next.note}</p>
          <Button onClick={() => (next.action === 'complete' ? setConfirming(true) : action.mutate({ rideId, action: next.action }))} disabled={action.isPending}>{next.label}</Button>
        </div>
      )}
      <ConfirmDialog open={confirming} title="Complete this trip?" confirmLabel="Complete trip" cancelLabel="Not yet" pending={action.isPending}
        onCancel={() => setConfirming(false)} onConfirm={() => action.mutate({ rideId, action: 'complete' }, { onSettled: () => setConfirming(false) })}>
        <p>The final fare is calculated on completion and the trip is added to your earnings.</p>
      </ConfirmDialog>
    </Card>
  );
}

function Availability({ online, approved, hasVehicle }: { online: boolean; approved: boolean; hasVehicle: boolean }) {
  const set = useSetAvailability();
  const { data: places } = usePlaceSearch('');
  const [sampleId, setSampleId] = useState('');
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState('');
  const [localError, setLocalError] = useState('');
  const { data: me } = useDriverMe();

  const useBrowserLocation = () => {
    setGeoError('');
    if (!('geolocation' in navigator)) return setGeoError('This browser cannot share your location. Choose a sample location instead.');
    navigator.geolocation.getCurrentPosition(
      (p) => { setGeo({ lat: p.coords.latitude, lng: p.coords.longitude }); setSampleId(''); },
      (e) => setGeoError(e.code === e.PERMISSION_DENIED ? 'Location permission was denied. Choose a sample location instead.' : 'Could not get your location. Choose a sample location instead.'),
      { timeout: 10_000 },
    );
  };
  const goOnline = () => {
    const sample = places?.places.find((p) => p.id === sampleId);
    const coords = geo ?? (sample ? { lat: sample.lat, lng: sample.lng } : null);
    if (!coords && !me?.profile.location) return setLocalError('Choose your current location first.');
    setLocalError('');
    set.mutate({ isOnline: true, ...(coords ?? {}) });
  };

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Availability</h2>
        <Badge tone={online ? 'success' : 'neutral'}>{online ? 'Online' : 'Offline'}</Badge>
      </div>
      {!approved && <Alert tone="warning">Your account must be approved before you can go online. In this demonstration approval is simulated and done by an administrator.</Alert>}
      {approved && !hasVehicle && <Alert tone="warning">Add an active vehicle before going online. <Link className="font-semibold underline" to="/driver/vehicle">Add a vehicle</Link></Alert>}
      {approved && hasVehicle && !online && (
        <div className="space-y-3">
          <div>
            <label htmlFor="driver-location" className="text-sm font-medium">Your location (development: there is no live GPS)</label>
            <select id="driver-location" value={sampleId} onChange={(e) => { setSampleId(e.target.value); setGeo(null); }} className="mt-1 block min-h-[44px] w-full rounded-lg border border-navy-900/25 bg-white px-3">
              <option value="">{me?.profile.location ? 'Keep my last location' : 'Choose a sample location…'}</option>
              {places?.places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <Button variant="outline" onClick={useBrowserLocation}>Use my browser location{geo ? ' (set)' : ''}</Button>
          {geoError && <Alert tone="info">{geoError}</Alert>}
        </div>
      )}
      {localError && <Alert tone="error">{localError}</Alert>}
      {set.isError && <Alert tone="error">{set.error.message}</Alert>}
      {approved && hasVehicle && (online
        ? <Button variant="outline" onClick={() => set.mutate({ isOnline: false })} disabled={set.isPending}>Go offline</Button>
        : <Button onClick={goOnline} disabled={set.isPending}>{set.isPending ? 'Going online…' : 'Go online'}</Button>)}
    </Card>
  );
}

export function DriverHome() {
  useDocumentTitle('Driver dashboard');
  const { data: me, isLoading, error } = useDriverMe();
  const online = !!me?.profile.isOnline;
  const offers = useDriverRequests(online);
  const active = useDriverRides('active', 1, 5, online);
  const today = useDriverEarnings('day');
  const current = active.data?.items.find((r) => r.status !== 'DRIVER_ASSIGNED');

  if (isLoading) return <Skeleton className="h-64 max-w-3xl" />;
  if (error || !me) return <Alert tone="error">{error?.message ?? 'Could not load your profile.'}</Alert>;
  const { profile } = me;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Driver dashboard</h1>
        <Badge tone={profile.approvalStatus === 'APPROVED' ? 'success' : 'warning'}>{profile.approvalStatus}</Badge>
      </div>

      <Availability online={online} approved={profile.approvalStatus === 'APPROVED'} hasVehicle={profile.vehicles.length > 0} />

      <div aria-live="polite" className="space-y-4">
        {(offers.data ?? []).map((o) => <OfferCard key={o.rideId} offer={o} />)}
      </div>
      {online && !current && (offers.data?.length ?? 0) === 0 && <p className="text-navy-900/75">Waiting for ride requests. This page checks for new requests every few seconds.</p>}
      {current && <ActiveRide rideId={current.id} />}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><p className="text-sm text-navy-900/70">Today’s trips</p><p className="text-2xl font-bold">{today.data?.trips ?? '–'}</p></Card>
        <Card><p className="text-sm text-navy-900/70">Today’s net earnings</p><p className="text-2xl font-bold">{today.data ? formatMinorAsRand(today.data.netMinor) : '–'}</p></Card>
        <Card><p className="text-sm text-navy-900/70">Rating</p><p className="text-2xl font-bold">{profile.ratingCount > 0 ? `${profile.ratingAverage.toFixed(1)} ★` : 'No ratings yet'}</p>{profile.ratingCount > 0 && <p className="text-xs text-navy-900/70">{profile.ratingCount} rating{profile.ratingCount === 1 ? '' : 's'}</p>}</Card>
      </div>
      <p className="text-sm"><Link className="font-semibold underline" to="/driver/earnings">View earnings</Link> · <Link className="font-semibold underline" to="/driver/rides">Trip history</Link></p>
      <Alert tone="info">Document upload and notifications are added in later build phases.</Alert>
    </div>
  );
}
