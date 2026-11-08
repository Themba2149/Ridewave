import type { PlaceValue } from '../../features/rides/types';

/**
 * Development route preview: a schematic drawn from the two coordinates. It is NOT a real map and shows no real roads or traffic.
 * A live map component can replace this behind the same props.
 */
export function RoutePreview({ pickup, dropoff }: { pickup: PlaceValue; dropoff: PlaceValue }) {
  const W = 400, H = 200, PAD = 36;
  const minLat = Math.min(pickup.lat, dropoff.lat), maxLat = Math.max(pickup.lat, dropoff.lat);
  const minLng = Math.min(pickup.lng, dropoff.lng), maxLng = Math.max(pickup.lng, dropoff.lng);
  const spanLat = Math.max(maxLat - minLat, 0.01), spanLng = Math.max(maxLng - minLng, 0.01);
  const pt = (p: PlaceValue) => ({ x: PAD + ((p.lng - minLng) / spanLng) * (W - 2 * PAD), y: H - PAD - ((p.lat - minLat) / spanLat) * (H - 2 * PAD) });
  const a = pt(pickup), b = pt(dropoff);
  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Schematic route from ${pickup.address} to ${dropoff.address}`} className="w-full rounded-lg bg-navy-800">
        <defs><pattern id="rp-grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="#1E2B45" /></pattern></defs>
        <rect width={W} height={H} fill="url(#rp-grid)" />
        <path d={`M${a.x} ${a.y} L${a.x} ${b.y} L${b.x} ${b.y}`} fill="none" stroke="#B9F227" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="8 6" />
        <circle cx={a.x} cy={a.y} r="9" fill="#F8FAFC" stroke="#0B1220" strokeWidth="3" /><text x={a.x} y={a.y + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#0B1220">A</text>
        <circle cx={b.x} cy={b.y} r="9" fill="#B9F227" stroke="#0B1220" strokeWidth="3" /><text x={b.x} y={b.y + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#0B1220">B</text>
      </svg>
      <figcaption className="mt-1 text-xs text-slate-600">Development map: a schematic, not a real map or live route. A = pickup, B = destination.</figcaption>
    </figure>
  );
}
