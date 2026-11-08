import { formatDistance, formatDuration, formatMinorAsRand } from '../../lib/formatters';
import type { FareBreakdown } from '../../features/rides/types';

export function FareBreakdownTable({ fare, final = false }: { fare: FareBreakdown; final?: boolean }) {
  const rows: Array<[string, number]> = [
    ['Base fare', fare.baseFareMinor],
    [`Distance (${formatDistance(fare.distanceMeters)})`, fare.distanceChargeMinor],
    [`Time (${formatDuration(fare.durationSeconds)})`, fare.timeChargeMinor],
    ...(fare.demandAdjustmentMinor > 0 ? [['Demand adjustment', fare.demandAdjustmentMinor] as [string, number]] : []),
    ['Booking fee', fare.bookingFeeMinor],
    ...(fare.minimumFareTopUpMinor > 0 ? [['Minimum fare adjustment', fare.minimumFareTopUpMinor] as [string, number]] : []),
    ...(fare.roundingAdjustmentMinor > 0 ? [['Rounding', fare.roundingAdjustmentMinor] as [string, number]] : []),
  ];
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">{final ? 'Final fare breakdown' : 'Estimated fare breakdown'}</caption>
      <tbody>
        {rows.map(([label, amount]) => (
          <tr key={label} className="border-b border-navy-900/10"><th scope="row" className="py-2 text-left font-normal">{label}</th><td className="py-2 text-right">{formatMinorAsRand(amount)}</td></tr>
        ))}
        <tr><th scope="row" className="pt-3 text-left text-base font-bold">{final ? 'Total fare' : 'Estimated total'}</th><td className="pt-3 text-right text-lg font-bold">{formatMinorAsRand(fare.totalMinor)}</td></tr>
      </tbody>
    </table>
  );
}
