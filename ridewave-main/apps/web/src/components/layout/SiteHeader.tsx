import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { homePathFor, useCurrentUser, useLogout } from '../../features/auth/useAuth';
import { primaryNav } from '../navigation/nav-links';
import { ButtonLink } from '../ui/Button';
import { Logo } from './Logo';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-white/10 text-accent' : 'text-ink hover:text-accent'}`;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  useEffect(() => setOpen(false), [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-navy-900 text-ink">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Logo className="text-ink" />
        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {primaryNav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={linkClass}>{n.label}</NavLink>
          ))}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          {user ? (
            <>
              <ButtonLink to={homePathFor(user.role)} className="!min-h-[40px] !py-1.5">Dashboard</ButtonLink>
              <button type="button" onClick={() => logout.mutate()} className="min-h-[40px] rounded-lg border border-white/30 px-4 text-sm font-semibold hover:bg-white/10">Sign out</button>
            </>
          ) : (
            <>
              <ButtonLink to="/login" variant="secondary" className="!min-h-[40px] !py-1.5">Sign In</ButtonLink>
              <ButtonLink to="/register" className="!min-h-[40px] !py-1.5">Get Started</ButtonLink>
            </>
          )}
        </div>
        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-ink hover:bg-white/10 lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X aria-hidden /> : <Menu aria-hidden />}
        </button>
      </div>
      {open && (
        <div id="mobile-nav" className="border-t border-white/10 bg-navy-800 lg:hidden">
          <nav aria-label="Mobile" className="container-page flex flex-col gap-1 py-4">
            {primaryNav.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={(s) => `${linkClass(s)} min-h-[44px] py-3 text-base`}>{n.label}</NavLink>
            ))}
            <div className="mt-3 grid grid-cols-2 gap-3">
              {user ? (
                <>
                  <ButtonLink to={homePathFor(user.role)}>Dashboard</ButtonLink>
                  <button type="button" onClick={() => logout.mutate()} className="min-h-[44px] rounded-lg border border-white/30 font-semibold">Sign out</button>
                </>
              ) : (
                <>
                  <ButtonLink to="/login" variant="secondary">Sign In</ButtonLink>
                  <ButtonLink to="/register">Get Started</ButtonLink>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
