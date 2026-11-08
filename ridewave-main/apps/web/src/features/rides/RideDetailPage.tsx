import { zodResolver } from '@hookform/resolvers/zod';
import { Star } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useParams } from 'react-router-dom';
import { z } from 'zod';
import { FareBreakdownTable } from '../../components/booking/FareBreakdownTable';
import { TextAreaField } from '../../components/forms/TextField';
import { RoutePreview } from '../../components/maps/RoutePreview';
import { Alert } from '../../components/ui/Alert';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { RideStatusBadge } from '../../components/ui/RideStatusBadge';
import { Skeleton } from '../../components/ui/Skeleton';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatDateTime, formatDistance, formatDuration, formatMinorAsRand } from '../../lib/formatters';
import { isActiveStatus, STATUS_LABEL } from '../../lib/ride-status';
import { PayForRideCard } from '../payments/PayForRideCard';
import { useCancelRide, useRetryRide, useRide, useSubmitReview } from './api';
import type { RideDetail } from './types';

const reviewSchema = z.object({ rating: z.coerce.number().int().min(1, 'Choose a rating').max(5), comment: z.string().trim().max(500, 'Keep it under 500 characters').optional() });
type ReviewValues = z.infer<typeof reviewSchema>;

function ReviewForm({ rideId }: { rideId: string }) {
  const submit = useSubmitReview(rideId);
  const { register, handleSubmit, formState: { errors } } = useForm<ReviewValues>({ resolver: zodResolver(reviewSchema) });
  return (
    <Card>
      <h2 className="text-lg font-bold">Rate your driver</h2>
      <form noValidate onSubmit={handleSubmit((v) => submit.mutate({ rating: v.rating, ...(v.comment ? { comment: v.comment } : {}) }))} className="mt-3 space-y-4">
        {submit.isError && <Alert tone="error">{submit.error.message}</Alert>}
        <fieldset>
          <legend className="text-sm font-medium">Rating</legend>
          <div className="mt-2 flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} className="flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-lg border border-navy-900/25 has-[:checked]:border-navy-900 has-[:checked]:bg-accent/30 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-sky-500">
                <input type="radio" value={n} className="sr-only" {...register('rating')} />
                <span className="flex items-center gap-1 font-semibold">{n}<Star aria-hidden className="h-4 w-4" /><span className="sr-only"> out of 5</span></span>
              </label>
            ))}
          </div>
          {errors.rating && <p role="alert" className="mt-1 text-sm text-danger">{errors.rating.message}</p>}
        </fieldset>
        <TextAreaField label="Comment (optional)" error={errors.comment?.message} {...register('comment')} />
        <Button type="submit" disabled={submit.isPending}>{submit.isPending ? 'Sending…' : 'Submit review'}</Button>
      </form>
    </Card>
  );
}

function StatusNote({ ride }: { ride: RideDetail }) {
  const retry = useRetryRide(ride.id);
  const eta = ride.driverEtaSeconds !== null ? ` about ${formatDuration(ride.driverEtaSeconds)} from pickup (development estimate)` : '';
  switch (ride.status) {
    case 'SEARCHING_FOR_DRIVER': case 'REQUESTED':
      return <Alert tone="info">We are looking for an available driver nearby. This page updates automatically. If nobody is available you can retry or cancel.</Alert>;
    case 'DRIVER_ASSIGNED':
      return <Alert tone="info">We asked {ride.driver?.fullName ?? 'a driver'} to take your ride and are waiting for them to accept{eta ? `. They are${eta}` : ''}. If they do not answer in time we will ask another driver.</Alert>;
    case 'DRIVER_ARRIVING':
      return <Alert tone="success">{ride.driver?.fullName ?? 'Your driver'} accepted and is on the way{eta ? `, ${eta.trim()}` : ''}. Check the registration number before you get in.</Alert>;
    case 'DRIVER_ARRIVED':
      return <Alert tone="success">Your driver has arrived at the pickup point.</Alert>;
    case 'IN_PROGRESS':
      return <Alert tone="info">Your trip is in progress.</Alert>;
    case 'NO_DRIVER_AVAILABLE':
      return (
        <Alert tone="warning">
          No driver is available right now. You can search again or cancel.
          {retry.isError && <span className="mt-1 block font-semibold">{retry.error.message}</span>}
          <span className="mt-2 block"><Button onClick={() => retry.mutate()} disabled={retry.isPending}>{retry.isPending ? 'Searching…' : 'Search again'}</Button></span>
        </Alert>
      );
    case 'CANCELLED':
      return <Alert tone="info">This ride was cancelled{ride.cancelledBy ? ` by the ${ride.cancelledBy.toLowerCase()}` : ''}{ride.cancellationReason ? `: ${ride.cancellationReason}` : ''}.</Alert>;
    default:
      return null;
  }
}

export function RideDetailPage() {
  const { rideId = '' } = useParams();
  useDocumentTitle('Ride details');
  const { data: ride, isLoading, error } = useRide(rideId);
  const cancel = useCancelRide(rideId);
  const [confirming, setConfirming] = useState(false);

  if (isLoading) return <Skeleton className="h-64 max-w-3xl" />;
  if (error || !ride) return <div className="max-w-xl space-y-3"><Alert tone="error">{error?.message ?? 'Ride not found.'}</Alert><ButtonLink to="/passenger/rides" variant="outline">Back to my rides</ButtonLink></div>;

  const canCancel = ride.status !== 'IN_PROGRESS' && isActiveStatus(ride.status) || ride.status === 'NO_DRIVER_AVAILABLE';
  const driverCommitted = ['DRIVER_ARRIVING', 'DRIVER_ARRIVED'].includes(ride.status);
  const fee = ride.cancellationPolicy.feeMinor;
  const cancelFee = ride.fareBreakdown && 'type' in ride.fareBreakdown ? ride.fareBreakdown : null;
  const fare = ride.fareBreakdown && !('type' in ride.fareBreakdown) ? ride.fareBreakdown : null;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Your ride</h1>
        <span aria-live="polite"><RideStatusBadge status={ride.status} /></span>
      </div>
      <StatusNote ride={ride} />
      {isActiveStatus(ride.status) && <p className="text-xs text-navy-900/70">This page updates automatically as your ride progresses.</p>}

      <Card className="space-y-4">
        <RoutePreview pickup={ride.pickup} dropoff={ride.dropoff} />
        <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-navy-900/70">From</dt><dd>{ride.pickup.address}</dd>
          <dt className="text-navy-900/70">To</dt><dd>{ride.dropoff.address}</dd>
          <dt className="text-navy-900/70">Ride</dt><dd>{ride.category.name}</dd>
          <dt className="text-navy-900/70">Trip</dt><dd>{formatDistance(ride.distanceMeters)} · about {formatDuration(ride.durationSeconds)} ({ride.routeSource.startsWith('dev') ? 'development estimate' : 'route estimate'})</dd>
          <dt className="text-navy-900/70">Requested</dt><dd>{formatDateTime(ride.requestedAt)}</dd>
        </dl>
      </Card>

      {ride.driver && (
        <Card>
          <h2 className="text-lg font-bold">{ride.status === 'DRIVER_ASSIGNED' ? 'Requested driver' : 'Your driver'}</h2>
          <p className="mt-2 font-semibold">{ride.driver.fullName}</p>
          <p className="text-sm text-navy-900/75">{ride.driver.ratingCount > 0 ? `${ride.driver.ratingAverage.toFixed(1)} ★ (${ride.driver.ratingCount} ratings)` : 'New driver, no ratings yet'}</p>
          {ride.driver.vehicle && <p className="mt-1 text-sm">{ride.driver.vehicle.colour} {ride.driver.vehicle.make} {ride.driver.vehicle.model} · <span className="font-mono font-semibold">{ride.driver.vehicle.registration}</span></p>}
        </Card>
      )}

      <Card>
        <h2 className="text-lg font-bold">{ride.status === 'COMPLETED' ? 'Final fare' : cancelFee ? 'Cancellation fee' : 'Estimated fare'}</h2>
        {cancelFee ? <p className="mt-2 text-2xl font-bold">{formatMinorAsRand(cancelFee.totalMinor)}</p>
          : fare ? <div className="mt-2"><FareBreakdownTable fare={fare} final={ride.status === 'COMPLETED'} /></div>
          : <p className="mt-2 text-2xl font-bold">{formatMinorAsRand(ride.estimatedFareMinor)}</p>}
        {ride.status === 'CANCELLED' && !cancelFee && <p className="mt-2 text-sm text-navy-900/75">No charge for this cancelled ride.</p>}
      </Card>

      <Card>
        <h2 className="text-lg font-bold">Status history</h2>
        <ol className="mt-3 space-y-2 border-l-2 border-navy-900/15 pl-4">
          {ride.statusHistory.map((h, i) => (
            <li key={i} className="text-sm"><span className="font-semibold">{STATUS_LABEL[h.toStatus]}</span><span className="text-navy-900/70"> · {formatDateTime(h.createdAt)}</span></li>
          ))}
        </ol>
      </Card>

      {ride.status === 'COMPLETED' && (
        <div className="space-y-4">
          <PayForRideCard ride={ride} />
          <ButtonLink to={`/passenger/rides/${ride.id}/receipt`} variant="dark">View receipt</ButtonLink>
          {ride.driver && (ride.hasReview ? <Alert tone="success">Thanks, you have reviewed this ride.</Alert> : <ReviewForm rideId={ride.id} />)}
        </div>
      )}

      {canCancel && (
        <div>
          {cancel.isError && <div className="mb-3"><Alert tone="error">{cancel.error.message}</Alert></div>}
          <Button variant="outline" onClick={() => setConfirming(true)}>Cancel ride</Button>
          <ConfirmDialog open={confirming} title="Cancel this ride?" confirmLabel="Yes, cancel ride" pending={cancel.isPending}
            onCancel={() => setConfirming(false)} onConfirm={() => cancel.mutate(undefined, { onSettled: () => setConfirming(false) })}>
            {driverCommitted && fee > 0
              ? <p>A cancellation fee of {formatMinorAsRand(fee)} applies if you cancel more than {Math.round(ride.cancellationPolicy.freeWindowSeconds / 60)} minutes after a driver was assigned.</p>
              : <p>There is no charge for cancelling now.</p>}
          </ConfirmDialog>
        </div>
      )}
      <p><Link className="text-sm font-semibold underline" to="/passenger/rides">Back to my rides</Link></p>
    </div>
  );
}
