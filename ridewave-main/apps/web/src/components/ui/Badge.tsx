import type { ReactNode } from 'react';

const tones = {
  neutral: 'bg-navy-900/8 text-navy-900 border-navy-900/15',
  accent: 'bg-accent/25 text-navy-900 border-accent-dark/40',
  warning: 'bg-warning/15 text-amber-900 border-warning/40',
  success: 'bg-success/10 text-green-900 border-success/30',
} as const;

export function Badge({ tone = 'neutral', children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}
