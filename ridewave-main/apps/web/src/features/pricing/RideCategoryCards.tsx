import { Car, Crown, Sparkles, Users, type LucideIcon } from 'lucide-react';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatMinorAsRand } from '../../lib/formatters';
import { useRideCategories } from './useRideCategories';

const icons: Record<string, LucideIcon> = { ECONOMY: Car, COMFORT: Sparkles, XL: Users, PREMIUM: Crown };

export function RideCategoryCards({ detailed = false }: { detailed?: boolean }) {
  const { data, isLoading, error, refetch } = useRideCategories();

  if (isLoading) {
    return <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4" role="status" aria-label="Loading ride options">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-56" />)}</div>;
  }
  if (error) {
    return (
      <div className="space-y-3">
        <Alert tone="error">Ride options could not be loaded: {error.message}</Alert>
        <button className="rounded-lg border border-navy-900/25 px-4 py-2 font-semibold" onClick={() => refetch()}>Try again</button>
      </div>
    );
  }
  if (!data || data.length === 0) {
    return <Alert tone="info">No ride categories are configured yet. Run <code>npm run db:seed</code> to load the demonstration categories.</Alert>;
  }

  return (
    <div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {data.map((c) => {
          const Icon = icons[c.code] ?? Car;
          return (
            <Card key={c.code} className="flex flex-col">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-navy-900 text-accent"><Icon aria-hidden className="h-6 w-6" /></div>
              <h3 className="mt-4 text-lg font-bold">{c.name}</h3>
              <p className="mt-1 text-sm text-navy-900/75">{c.description}</p>
              <p className="mt-3 text-sm"><span className="font-semibold">Up to {c.capacity} passengers</span>{c.luggageNote && <> · {c.luggageNote}</>}</p>
              <p className="mt-auto pt-4 text-sm text-navy-900/70">Minimum fare</p>
              <p className="text-2xl font-bold">{formatMinorAsRand(c.minimumFareMinor)}</p>
              {detailed && (
                <dl className="mt-3 space-y-1 border-t border-navy-900/10 pt-3 text-sm">
                  <div className="flex justify-between"><dt>Base fare</dt><dd>{formatMinorAsRand(c.baseFareMinor)}</dd></div>
                  <div className="flex justify-between"><dt>Per kilometre</dt><dd>{formatMinorAsRand(c.perKmMinor)}</dd></div>
                  <div className="flex justify-between"><dt>Per minute</dt><dd>{formatMinorAsRand(c.perMinuteMinor)}</dd></div>
                  <div className="flex justify-between"><dt>Booking fee</dt><dd>{formatMinorAsRand(c.bookingFeeMinor)}</dd></div>
                </dl>
              )}
            </Card>
          );
        })}
      </div>
      <p className="mt-4 flex items-center gap-2 text-sm text-navy-900/70"><Badge tone="warning">Demonstration rates</Badge> Illustrative figures for testing, not official or market-verified prices. Your real estimate is calculated by the server when you book.</p>
    </div>
  );
}
