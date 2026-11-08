import { Link } from 'react-router-dom';

export function Logo({ className = '' }: { className?: string }) {
  return (
    <Link to="/" aria-label="RideWave home" className={`inline-flex items-center gap-2 font-bold tracking-tight ${className}`}>
      <svg aria-hidden viewBox="0 0 32 32" className="h-8 w-8">
        <rect width="32" height="32" rx="8" fill="#B9F227" />
        <path d="M5 20c4-7 7-7 11 0s7 7 11 0" fill="none" stroke="#0B1220" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <span className="text-xl">Ride<span className="text-accent">Wave</span></span>
    </Link>
  );
}
