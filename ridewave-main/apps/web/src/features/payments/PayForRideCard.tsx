import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { formatMinorAsRand } from '../../lib/formatters';
import type { RideDetail } from '../rides/types';
import { useCheckout, usePayment, usePaymentMethods, type Payment } from './api';

export const methodLabel = (p: Pick<Payment, 'method'>) => (p.method === 'CASH' ? 'Cash' : p.method === 'CARD' ? 'Card' : 'Digital wallet');

function StatusPanel({ ride, payment }: { ride: RideDetail; payment: NonNullable<RideDetail['payment']> }) {
  const qc = useQueryClient();
  const live = usePayment(payment.id, payment.method !== 'CASH' && payment.status === 'PENDING');
  useEffect(() => { if (live.data && live.data.status !== payment.status) qc.invalidateQueries({ queryKey: ['ride', ride.id] }); }, [live.data, payment.status, qc, ride.id]);
  const amount = formatMinorAsRand(ride.finalFareMinor ?? ride.estimatedFareMinor);
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-bold">Payment</h2>{payment.isSimulated && <Badge tone="warning">Simulated: no real money moved</Badge>}</div>
      <p role="status" className="mt-2">
        {payment.status === 'SUCCEEDED' && <>Paid {amount} by {methodLabel(payment).toLowerCase()}.</>}
        {payment.status === 'PENDING' && payment.method === 'CASH' && <>Please pay {amount} in cash to your driver. It is marked as paid when the driver confirms they received it.</>}
        {payment.status === 'PENDING' && payment.method !== 'CASH' && <>Your {methodLabel(payment).toLowerCase()} payment of {amount} is still processing. This page updates automatically.</>}
        {payment.status === 'PROCESSING' && <>Processing your payment…</>}
        {payment.status === 'REFUNDED' && <>This payment was refunded.</>}
      </p>
      <p className="mt-2"><Link className="text-sm font-semibold underline" to={`/passenger/rides/${ride.id}/receipt`}>View receipt</Link></p>
    </Card>
  );
}

export function PayForRideCard({ ride }: { ride: RideDetail }) {
  const methods = usePaymentMethods();
  const checkout = useCheckout(ride.id);
  const failed = ride.payment?.status === 'FAILED';
  const failure = usePayment(failed ? ride.payment?.id : undefined);
  const [choice, setChoice] = useState<string>('');

  if (ride.payment && ride.payment.status !== 'FAILED') return <StatusPanel ride={ride} payment={ride.payment} />;

  const saved = methods.data ?? [];
  const selected = choice || saved.find((m) => m.isDefault)?.id || 'CASH';
  const amount = formatMinorAsRand(ride.finalFareMinor ?? ride.estimatedFareMinor);
  const pay = () => {
    const m = saved.find((x) => x.id === selected);
    checkout.mutate(m ? { method: m.type, paymentMethodId: m.id } : { method: 'CASH' });
  };

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-bold">Pay for this ride</h2><Badge tone="warning">Demonstration: payments are simulated</Badge></div>
      {failed && <Alert tone="error">Your last payment failed{failure.data?.failureReason ? `: ${failure.data.failureReason}` : ''}. Choose a method and try again.</Alert>}
      {checkout.isError && <Alert tone="error">{checkout.error.message}</Alert>}
      <fieldset>
        <legend className="text-sm font-medium">Payment method</legend>
        <div className="mt-2 space-y-2">
          <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border border-navy-900/25 p-3 has-[:checked]:border-navy-900 has-[:checked]:bg-accent/20">
            <input type="radio" name="pay-method" value="CASH" checked={selected === 'CASH'} onChange={() => setChoice('CASH')} className="h-5 w-5" /><span>Cash <span className="text-sm text-navy-900/70">(pay your driver directly)</span></span>
          </label>
          {saved.map((m) => (
            <label key={m.id} className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border border-navy-900/25 p-3 has-[:checked]:border-navy-900 has-[:checked]:bg-accent/20">
              <input type="radio" name="pay-method" value={m.id} checked={selected === m.id} onChange={() => setChoice(m.id)} className="h-5 w-5" /><span>{m.label}{m.last4 ? ` •••• ${m.last4}` : ''}{m.isDefault && <> <Badge tone="accent">Default</Badge></>}</span>
            </label>
          ))}
        </div>
        <p className="mt-2 text-sm"><Link className="font-semibold underline" to="/passenger/payments">Manage payment methods</Link></p>
      </fieldset>
      <Button onClick={pay} disabled={checkout.isPending}>{checkout.isPending ? 'Paying…' : `Pay ${amount}`}</Button>
    </Card>
  );
}
