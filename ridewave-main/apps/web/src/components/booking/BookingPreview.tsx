import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { tripPreviewSchema, type TripPreviewValues } from '../../lib/validators';
import { TextField } from '../forms/TextField';
import { Button } from '../ui/Button';

/** Captures a trip idea and carries it to sign-up. No fare is calculated until booking exists (Phase 4). */
export function BookingPreview() {
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors } } = useForm<TripPreviewValues>({ resolver: zodResolver(tripPreviewSchema) });

  return (
    <form
      noValidate
      onSubmit={handleSubmit((v) => navigate('/register', { state: { trip: v } }))}
      className="space-y-4 rounded-xl2 bg-surface p-6 text-navy-900 shadow-card"
      aria-label="Plan a trip"
    >
      <h2 className="text-xl font-bold">Where to?</h2>
      <TextField label="Pickup location" placeholder="e.g. Sandton City" autoComplete="off" error={errors.pickup?.message} {...register('pickup')} />
      <TextField label="Destination" placeholder="e.g. OR Tambo International" autoComplete="off" error={errors.destination?.message} {...register('destination')} />
      <Button type="submit" className="w-full">Book a Ride</Button>
      <p className="text-xs text-slate-600">Booking preview: you’ll create a free account first. Fare estimates arrive with passenger booking in a later build phase.</p>
    </form>
  );
}
