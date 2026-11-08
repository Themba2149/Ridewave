import { ButtonLink } from '../../components/ui/Button';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { RideCategoryCards } from '../pricing/RideCategoryCards';
import { FinalCta, PageHero } from './Sections';

export function RideOptionsPage() {
  useDocumentTitle('Ride Options');
  return (
    <>
      <PageHero title="Ride options" intro="Choose the category that fits your trip, group size and luggage." />
      <section className="section"><div className="container-page">
        <RideCategoryCards detailed />
        <p className="mt-8 max-w-3xl text-navy-900/75">Fares combine a base fare, distance and time charges, and a booking fee, subject to a minimum fare. Luggage guidance is a rough guide; confirm with your driver for bulky items.</p>
      </div></section>
      <FinalCta title="Pick your ride" text="Sign up to request a ride."><ButtonLink to="/register">Get Started</ButtonLink></FinalCta>
    </>
  );
}
