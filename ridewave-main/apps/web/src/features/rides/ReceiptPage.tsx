import { Printer } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { FareBreakdownTable } from '../../components/booking/FareBreakdownTable';
import { Alert } from '../../components/ui/Alert';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatDateTime } from '../../lib/formatters';
import { Badge } from '../../components/ui/Badge';
import { methodLabel } from '../payments/PayForRideCard';
import type { Payment } from '../payments/api';
import { useReceipt } from './api';

function PaymentSection({ payment }: { payment: Payment | null }) {
  if (!payment) return <Alert tone="info">No payment has been recorded for this ride yet. You can pay from the ride page.</Alert>;
  return (
    <div className="rounded-lg border border-navy-900/15 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">Payment</h2>{payment.isSimulated && <Badge tone="warning">Simulated: no real money moved</Badge>}</div>
      <dl className="mt-2 grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-navy-900/70">Method</dt><dd>{methodLabel(payment)}{payment.description ? ` · ${payment.description}` : ''}</dd>
        <dt className="text-navy-900/70">Status</dt><dd>{payment.status === 'SUCCEEDED' ? 'Paid' : payment.status === 'PENDING' ? (payment.method === 'CASH' ? 'Awaiting cash confirmation from your driver' : 'Processing') : payment.status === 'FAILED' ? 'Failed' : payment.status}</dd>
        {payment.transactionRef && <><dt className="text-navy-900/70">Reference</dt><dd className="font-mono text-xs">{payment.transactionRef}</dd></>}
      </dl>
    </div>
  );
}

export function ReceiptPage() {
  const { rideId = '' } = useParams();
  useDocumentTitle('Receipt');
  const { data, isLoading, error } = useReceipt(rideId);
  if (isLoading) return <Skeleton className="h-64 max-w-2xl" />;
  if (error || !data) return <div className="max-w-xl space-y-3"><Alert tone="error">{error?.message ?? 'Receipt not available.'}</Alert><ButtonLink to={`/passenger/rides/${rideId}`} variant="outline">Back to ride</ButtonLink></div>;
  const { ride } = data;
  const fare = ride.fareBreakdown && !('type' in ride.fareBreakdown) ? ride.fareBreakdown : null;

  return (
    <div className="max-w-2xl space-y-4">
      <Card className="space-y-4 print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h1 className="text-2xl font-bold">Ride receipt</h1><p className="text-sm text-navy-900/70">{data.receiptNumber} · {formatDateTime(data.issuedAt)}</p></div>
          <p className="text-sm font-semibold">RideWave (demonstration)</p>
        </div>
        <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-navy-900/70">From</dt><dd>{ride.pickup.address}</dd>
          <dt className="text-navy-900/70">To</dt><dd>{ride.dropoff.address}</dd>
          <dt className="text-navy-900/70">Ride</dt><dd>{ride.category.name}</dd>
          {ride.driver && <><dt className="text-navy-900/70">Driver</dt><dd>{ride.driver.fullName}{ride.driver.vehicle ? ` · ${ride.driver.vehicle.registration}` : ''}</dd></>}
        </dl>
        {fare && <FareBreakdownTable fare={fare} final />}
        <PaymentSection payment={data.payment as Payment | null} />
        <p className="text-xs text-navy-900/70">This is a demonstration receipt, not a tax invoice.</p>
      </Card>
      <div className="flex gap-3 print:hidden">
        <Button onClick={() => window.print()}><Printer aria-hidden className="h-4 w-4" /> Print receipt</Button>
        <ButtonLink to={`/passenger/rides/${rideId}`} variant="outline">Back to ride</ButtonLink>
      </div>
    </div>
  );
}
