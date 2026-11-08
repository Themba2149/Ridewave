import type { HTMLAttributes } from 'react';

export function Card({ className = '', ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`rounded-xl2 border border-navy-900/10 bg-surface p-6 shadow-card ${className}`} {...rest} />;
}
