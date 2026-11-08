import { ButtonLink } from '../../components/ui/Button';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { passengerSteps } from './content';
import { FinalCta, PageHero, StepList } from './Sections';

export function HowItWorksPage() {
  useDocumentTitle('How It Works');
  return (
    <>
      <PageHero title="How RideWave works" intro="The passenger journey, from entering your trip to receiving a receipt." />
      <section className="section"><div className="container-page">
        <StepList steps={passengerSteps} />
        <div className="mt-12 max-w-3xl space-y-4 text-navy-900/80">
          <h2 className="text-2xl font-bold text-navy-900">The details</h2>
          <p><strong>Estimates and final fares.</strong> You see an estimate before you confirm. The final fare is shown on your receipt once the ride is complete; the two can differ.</p>
          <p><strong>Cancellations.</strong> You can cancel an eligible ride. Cancellation rules are configurable and shown before you cancel.</p>
          <p><strong>Ratings.</strong> After a completed ride you can rate your driver and leave feedback.</p>
        </div>
      </div></section>
      <FinalCta title="See it for yourself" text="Create an account to try the demonstration."><ButtonLink to="/register">Get Started</ButtonLink></FinalCta>
    </>
  );
}
