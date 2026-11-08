import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import type { ReactNode } from 'react';

const styles = {
  error: { box: 'border-danger/40 bg-danger/10 text-red-900', Icon: AlertCircle, role: 'alert' as const },
  success: { box: 'border-success/40 bg-success/10 text-green-900', Icon: CheckCircle2, role: 'status' as const },
  warning: { box: 'border-warning/50 bg-warning/15 text-amber-950', Icon: AlertTriangle, role: 'status' as const },
  info: { box: 'border-sky-600/30 bg-sky-50 text-sky-900', Icon: Info, role: 'status' as const },
};

export function Alert({ tone = 'info', children }: { tone?: keyof typeof styles; children: ReactNode }) {
  const { box, Icon, role } = styles[tone];
  return (
    <div role={role} className={`flex gap-3 rounded-lg border p-4 text-sm ${box}`}>
      <Icon aria-hidden className="mt-0.5 h-5 w-5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
