/** Static illustration. It is NOT a live map and shows no real drivers or routes. */
export function HeroIllustration() {
  return (
    <figure className="m-0">
      <svg viewBox="0 0 480 360" role="img" aria-label="Illustration of a route between a pickup point and a destination on a city grid" className="w-full rounded-xl2 bg-navy-800">
        <defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#1E2B45" strokeWidth="1" /></pattern></defs>
        <rect width="480" height="360" fill="url(#grid)" />
        <path d="M0 250 C120 230 160 290 260 250 S420 150 480 170" stroke="#1E2B45" strokeWidth="18" fill="none" />
        <path d="M70 280 L70 190 L190 190 L190 110 L340 110 L340 70 L410 70" fill="none" stroke="#B9F227" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 0" />
        <circle cx="70" cy="280" r="12" fill="#0B1220" stroke="#F8FAFC" strokeWidth="4" />
        <path d="M410 40c-12 0-20 9-20 20 0 15 20 34 20 34s20-19 20-34c0-11-8-20-20-20z" fill="#B9F227" /><circle cx="410" cy="60" r="7" fill="#0B1220" />
        <rect x="150" y="170" width="72" height="30" rx="15" fill="#F8FAFC" /><text x="186" y="190" textAnchor="middle" fontSize="13" fontWeight="700" fill="#0B1220">4 min</text>
      </svg>
      <figcaption className="mt-2 text-xs text-ink-muted">Illustration only — not a live map.</figcaption>
    </figure>
  );
}
