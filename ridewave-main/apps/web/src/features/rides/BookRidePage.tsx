import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FareBreakdownTable } from '../../components/booking/FareBreakdownTable';
import { PlaceField } from '../../components/booking/PlaceField';
import { RoutePreview } from '../../components/maps/RoutePreview';
import { Alert } from '../../components/ui/Alert';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { ApiError } from '../../lib/api-client';
import { formatDistance, formatDuration, formatMinorAsRand } from '../../lib/formatters';
import { useCreateRide, useEstimate, useMyRides, useSavedLocations } from './api';
import type { Estimate, PlaceValue } from './types';

const STEPS = ['Trip', 'Choose a ride', 'Review & confirm'];
const newKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`);

function Progress({ step }: { step: number }) {
  return (
    <ol aria-label="Booking progress" className="flex flex-wrap gap-2 text-sm">
      {STEPS.map((label, i) => (
        <li key={label} aria-current={step === i + 1 ? 'step' : undefined}
          className={`flex items-center gap-2 rounded-full border px-3 py-1 font-medium ${step === i + 1 ? 'border-navy-900 bg-navy-900 text-ink' : step > i + 1 ? 'border-success/40 bg-success/10' : 'border-navy-900/20 text-navy-900/60'}`}>
          <span aria-hidden>{i + 1}</span>{label}{step > i + 1 && <span className="sr-only"> (done)</span>}
        </li>
      ))}
    </ol>
  );
}

export function BookRidePage() {
  useDocumentTitle('Book a ride');
  const navigate = useNavigate();
  const active = useMyRides('active', 1, 1);
  const saved = useSavedLocations();
  const estimate = useEstimate();
  const create = useCreateRide();
  const idempotencyKey = useRef(newKey()); // one key per booking attempt: repeats return the same ride instead of a second one

  const [step, setStep] = useState(1);
  const [pickup, setPickup] = useState<PlaceValue | null>(null);
  const [dropoff, setDropoff] = useState<PlaceValue | null>(null);
  const [data, setData] = useState<Estimate | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [tripError, setTripError] = useState('');

  const activeRide = active.data?.items[0];
  if (active.isLoading) return <Skeleton className="h-64 max-w-3xl" />;
  if (activeRide) {
    return (
      <div className="max-w-2xl space-y-4">
        <h1 className="text-3xl font-bold">Book a ride</h1>
        <Alert tone="info">You already have an active ride. Finish or cancel it before booking another. <Link className="font-semibold underline" to={`/passenger/rides/${activeRide.id}`}>View your current ride</Link></Alert>
      </div>
    );
  }

  const selected = data?.options.find((o) => o.code === code) ?? null;

  const toOptions = () => {
    if (!pickup || !dropoff) return setTripError('Choose both a pickup location and a destination.');
    if (pickup.address === dropoff.address) return setTripError('Pickup and destination must be different.');
    setTripError('');
    estimate.mutate({ pickup, dropoff }, { onSuccess: (d) => { setData(d); setCode((c) => (d.options.some((o) => o.code === c) ? c : d.options[0]?.code ?? null)); setStep(2); } });
  };
  const confirm = () => {
    if (!pickup || !dropoff || !code) return;
    create.mutate({ pickup, dropoff, categoryCode: code, idempotencyKey: idempotencyKey.current }, { onSuccess: (d) => navigate(`/passenger/rides/${d.ride.id}`) });
  };
  const createError = create.error;

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold">Book a ride</h1>
      <Progress step={step} />
      <p className="sr-only" aria-live="polite">Step {step} of {STEPS.length}: {STEPS[step - 1]}</p>

      {step === 1 && (
        <Card className="space-y-5">
          <PlaceField label="Pickup location" value={pickup} onChange={setPickup} saved={saved.data} />
          <PlaceField label="Destination" value={dropoff} onChange={setDropoff} saved={saved.data} />
          {tripError && <Alert tone="error">{tripError}</Alert>}
          {estimate.isError && <Alert tone="error">{estimate.error.message}</Alert>}
          <Button onClick={toOptions} disabled={estimate.isPending}>{estimate.isPending ? 'Calculating fares…' : 'See ride options'}</Button>
        </Card>
      )}

      {step === 2 && data && pickup && dropoff && (
        <Card className="space-y-5">
          <p className="text-sm text-navy-900/75">
            {formatDistance(data.route.distanceMeters)} · about {formatDuration(data.route.durationSeconds)} ·{' '}
            {data.route.isLive ? 'live route' : 'development estimate (not a live route or live traffic)'}
          </p>
          <fieldset>
            <legend className="font-semibold">Choose your ride</legend>
            <div className="mt-3 grid gap-3">
              {data.options.map((o) => (
                <label key={o.code} className="flex min-h-[44px] cursor-pointer items-center justify-between gap-4 rounded-lg border border-navy-900/25 p-4 has-[:checked]:border-navy-900 has-[:checked]:bg-accent/20 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-sky-500">
                  <input type="radio" name="category" value={o.code} checked={code === o.code} onChange={() => setCode(o.code)} className="sr-only" />
                  <span><span className="block font-semibold">{o.name}</span><span className="block text-sm text-navy-900/75">Up to {o.capacity} passengers{o.luggageNote ? ` · ${o.luggageNote}` : ''}</span></span>
                  <span className="text-right"><span className="block text-lg font-bold">{formatMinorAsRand(o.fare.totalMinor)}</span><span className="block text-xs text-navy-900/70">estimate</span></span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex gap-3"><Button variant="outline" onClick={() => setStep(1)}>Back</Button><Button onClick={() => setStep(3)} disabled={!selected}>Continue</Button></div>
        </Card>
      )}

      {step === 3 && data && pickup && dropoff && selected && (
        <Card className="space-y-5">
          <RoutePreview pickup={pickup} dropoff={dropoff} />
          <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-navy-900/70">From</dt><dd>{pickup.address}</dd>
            <dt className="text-navy-900/70">To</dt><dd>{dropoff.address}</dd>
            <dt className="text-navy-900/70">Ride</dt><dd>{selected.name}</dd>
          </dl>
          <FareBreakdownTable fare={selected.fare} />
          <Alert tone="info">This is an estimate. Your final fare is calculated when the ride is completed and shown on your receipt. Driver arrival time is shown once a driver is assigned.</Alert>
          {createError && (
            <Alert tone="error">
              {createError.message}
              {createError instanceof ApiError && typeof (createError.details as { rideId?: string } | undefined)?.rideId === 'string' && (
                <> <Link className="font-semibold underline" to={`/passenger/rides/${(createError.details as { rideId: string }).rideId}`}>View it</Link></>
              )}
            </Alert>
          )}
          <div className="flex gap-3"><Button variant="outline" onClick={() => setStep(2)} disabled={create.isPending}>Back</Button><Button onClick={confirm} disabled={create.isPending}>{create.isPending ? 'Booking…' : 'Confirm booking'}</Button></div>
        </Card>
      )}
      {step === 1 && <p className="text-sm text-navy-900/70">Need a saved place? <ButtonLink to="/passenger/places" variant="outline" className="ml-1 !min-h-[36px] !py-1">Manage places</ButtonLink></p>}
    </div>
  );
}
