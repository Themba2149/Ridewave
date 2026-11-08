import { Bell, LogOut } from 'lucide-react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useCurrentUser, useLogout } from '../../features/auth/useAuth';
import { useUnreadCount } from '../../features/notifications/api';
import { RealtimeProvider, useRealtimeConnected } from '../../lib/realtime';
import { Badge } from '../ui/Badge';
import { Logo } from './Logo';

const navFor = (area: string) =>
  area === 'passenger'
    ? [{ to: '/passenger', label: 'Overview', end: true }, { to: '/passenger/book', label: 'Book a ride' }, { to: '/passenger/rides', label: 'My rides' }, { to: '/passenger/places', label: 'Places' }, { to: '/passenger/payments', label: 'Payments' }, { to: '/passenger/account', label: 'Account' }]
    : area === 'driver'
      ? [{ to: '/driver', label: 'Overview', end: true }, { to: '/driver/rides', label: 'Trips' }, { to: '/driver/earnings', label: 'Earnings' }, { to: '/driver/vehicle', label: 'Vehicle' }, { to: '/driver/documents', label: 'Documents' }, { to: '/driver/account', label: 'Account' }]
      : [{ to: '/admin', label: 'Overview', end: true }, { to: '/admin/users', label: 'Users' }, { to: '/admin/drivers', label: 'Drivers' }, { to: '/admin/rides', label: 'Rides' }, { to: '/admin/vehicles', label: 'Vehicles' },
         { to: '/admin/payments', label: 'Payments' }, { to: '/admin/pricing', label: 'Pricing' }, { to: '/admin/settings', label: 'Settings' }, { to: '/admin/notifications', label: 'Announcements' }, { to: '/admin/support', label: 'Support' }, { to: '/admin/audit', label: 'Audit' }, { to: '/admin/account', label: 'Account' }];

const titles = { passenger: 'Passenger', driver: 'Driver', admin: 'Administrator' } as const;

function Shell({ area }: { area: keyof typeof titles }) {
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  const navigate = useNavigate();
  const live = useRealtimeConnected();
  const unread = useUnreadCount().data ?? 0;
  const tab = ({ isActive }: { isActive: boolean }) =>
    `inline-flex min-h-[44px] shrink-0 items-center border-b-2 px-4 text-sm font-semibold ${isActive ? 'border-accent text-ink' : 'border-transparent text-ink-muted hover:text-ink'}`;

  return (
    <div className="min-h-screen bg-page">
      <header className="bg-navy-900 text-ink">
        <div className="container-page flex h-16 items-center justify-between gap-4">
          <Logo className="text-ink" />
          <div className="flex items-center gap-3">
            <span role="status" className="hidden text-xs text-ink-muted md:inline">{live ? '● Live updates' : '○ Updates every few seconds'}</span>
            <Link to={area === 'admin' ? '/admin/inbox' : `/${area}/notifications`} className="relative inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg hover:bg-white/10" aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}>
              <Bell aria-hidden className="h-5 w-5" />{unread > 0 && <span aria-hidden className="absolute right-1 top-1 min-w-[18px] rounded-full bg-accent px-1 text-center text-[11px] font-bold leading-[18px] text-navy-900">{unread > 99 ? '99+' : unread}</span>}
            </Link>
            <span className="hidden text-sm text-ink-muted sm:inline">{user?.fullName}</span>
            <Badge tone="accent">{titles[area]}</Badge>
            <button
              type="button"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-white/30 px-3 text-sm font-semibold hover:bg-white/10"
              onClick={() => logout.mutate(undefined, { onSettled: () => navigate('/', { replace: true }) })}
            >
              <LogOut aria-hidden className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
        <nav aria-label={`${titles[area]} navigation`} className="container-page flex gap-2 overflow-x-auto">
          {navFor(area).map((n) => <NavLink key={n.to} end={n.end} to={n.to} className={tab}>{n.label}</NavLink>)}
        </nav>
      </header>
      <main id="main" className="container-page py-8"><Outlet /></main>
    </div>
  );
}

export function DashboardLayout({ area }: { area: keyof typeof titles }) {
  return <RealtimeProvider><Shell area={area} /></RealtimeProvider>;
}
