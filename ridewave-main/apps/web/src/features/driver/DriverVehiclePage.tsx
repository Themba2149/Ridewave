import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { TextField } from '../../components/forms/TextField';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { vehicleSchema, type VehicleValues } from '../../lib/validators';
import { useRideCategories } from '../pricing/useRideCategories';
import { useAddVehicle, useVehicles } from './api';

export function DriverVehiclePage() {
  useDocumentTitle('Vehicle');
  const vehicles = useVehicles();
  const categories = useRideCategories();
  const add = useAddVehicle();
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<VehicleValues>({ resolver: zodResolver(vehicleSchema), defaultValues: { categoryCode: '' } });
  const chosen = categories.data?.find((c) => c.code === watch('categoryCode'));

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold">Vehicle</h1>
      {vehicles.isLoading && <Skeleton className="h-24" />}
      {vehicles.error && <Alert tone="error">{vehicles.error.message}</Alert>}
      {vehicles.data && vehicles.data.length === 0 && <Alert tone="info">You have not added a vehicle yet. You need one before you can go online.</Alert>}
      {vehicles.data?.map((v) => (
        <Card key={v.id}>
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-bold">{v.year} {v.make} {v.model}</h2><Badge tone="accent">{v.category.name}</Badge></div>
          <p className="mt-1 text-sm">{v.colour} · <span className="font-mono font-semibold">{v.registration}</span> · {v.passengerCapacity} seats</p>
        </Card>
      ))}

      <Card>
        <h2 className="text-lg font-bold">Add a vehicle</h2>
        <form noValidate onSubmit={handleSubmit((v) => add.mutate({ ...v, registration: v.registration.trim() }, { onSuccess: () => reset() }))} className="mt-4 grid gap-4 sm:grid-cols-2">
          {add.isError && <div className="sm:col-span-2"><Alert tone="error">{add.error.message}</Alert></div>}
          {add.isSuccess && <div className="sm:col-span-2"><Alert tone="success">Vehicle added.</Alert></div>}
          <div className="sm:col-span-2">
            <label htmlFor="v-category" className="text-sm font-medium">Ride category</label>
            <select id="v-category" aria-invalid={!!errors.categoryCode} className="mt-1 block min-h-[44px] w-full rounded-lg border border-navy-900/25 bg-white px-3" {...register('categoryCode')}>
              <option value="">Choose a category…</option>
              {categories.data?.map((c) => <option key={c.code} value={c.code}>{c.name} (needs {c.capacity}+ seats)</option>)}
            </select>
            {errors.categoryCode && <p role="alert" className="mt-1 text-sm text-danger">{errors.categoryCode.message}</p>}
            {chosen && <p className="mt-1 text-xs text-navy-900/70">{chosen.name} requires at least {chosen.capacity} passenger seats.</p>}
          </div>
          <TextField label="Make" error={errors.make?.message} {...register('make')} />
          <TextField label="Model" error={errors.model?.message} {...register('model')} />
          <TextField label="Year" inputMode="numeric" error={errors.year?.message} {...register('year')} />
          <TextField label="Colour" error={errors.colour?.message} {...register('colour')} />
          <TextField label="Registration" error={errors.registration?.message} {...register('registration')} />
          <TextField label="Passenger seats" inputMode="numeric" error={errors.passengerCapacity?.message} {...register('passengerCapacity')} />
          <div className="sm:col-span-2"><Button type="submit" disabled={add.isPending}>{add.isPending ? 'Adding…' : 'Add vehicle'}</Button></div>
        </form>
      </Card>
    </div>
  );
}
