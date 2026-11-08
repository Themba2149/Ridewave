import { Link } from 'react-router-dom';
import { Logo } from './Logo';

const col = 'space-y-2 text-sm text-ink-muted';
const a = 'inline-block py-1 hover:text-accent';

export function SiteFooter() {
  return (
    <footer className="bg-navy-900 text-ink">
      <div className="container-page grid gap-10 py-14 md:grid-cols-4">
        <div className="md:col-span-1">
          <Logo className="text-ink" />
          <p className="mt-3 text-sm text-ink-muted">Your journey. Your way.</p>
          <p className="mt-4 text-sm text-ink-muted">Johannesburg, South Africa<br />support@ridewave.example</p>
        </div>
        <nav aria-label="Product"><h2 className="mb-3 text-sm font-semibold">Ride</h2>
          <ul className={col}>
            <li><Link className={a} to="/how-it-works">How It Works</Link></li>
            <li><Link className={a} to="/ride-options">Ride Options</Link></li>
            <li><Link className={a} to="/safety">Safety</Link></li>
          </ul></nav>
        <nav aria-label="Company"><h2 className="mb-3 text-sm font-semibold">Company</h2>
          <ul className={col}>
            <li><Link className={a} to="/drive-with-us">Drive With Us</Link></li>
            <li><Link className={a} to="/contact">Contact &amp; Help</Link></li>
            <li><Link className={a} to="/status">System status</Link></li>
          </ul></nav>
        <nav aria-label="Legal"><h2 className="mb-3 text-sm font-semibold">Legal</h2>
          <ul className={col}>
            <li><Link className={a} to="/terms">Terms of Service</Link></li>
            <li><Link className={a} to="/privacy">Privacy Policy</Link></li>
          </ul></nav>
      </div>
      <div className="border-t border-white/10">
        <p className="container-page py-5 text-xs text-ink-muted">
          RideWave is a development demonstration. Rides, drivers, payments and maps shown here are simulated; no real trips are booked and no money is charged.
          The email address above is a placeholder.
        </p>
      </div>
    </footer>
  );
}
