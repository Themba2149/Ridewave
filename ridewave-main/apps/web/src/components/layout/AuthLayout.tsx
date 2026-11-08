import { Outlet } from 'react-router-dom';
import { Logo } from './Logo';

export function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-navy-900 px-5 py-10">
      <Logo className="text-ink" />
      <main id="main" className="mt-8 w-full max-w-md rounded-xl2 bg-surface p-6 shadow-card sm:p-8"><Outlet /></main>
      <p className="mt-6 max-w-md text-center text-xs text-ink-muted">Development demonstration: no real accounts, rides or payments.</p>
    </div>
  );
}
