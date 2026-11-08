const zar = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', minimumFractionDigits: 2 });

/** Formats integer minor units (cents) as rand. Never pass floating-point money in. */
export function formatMinorAsRand(minor: number): string {
  return zar.format(minor / 100);
}

export const formatDistance = (meters: number) => (meters < 1000 ? `${meters} m` : `${(meters / 1000).toFixed(1)} km`);
export const formatDuration = (seconds: number) => `${Math.max(1, Math.round(seconds / 60))} min`;
export const formatDateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg', dateStyle: 'medium', timeStyle: 'short' }) : '';
