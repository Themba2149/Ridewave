import { ShieldCheck } from 'lucide-react';
import { BookingPreview } from '../../components/booking/BookingPreview';
import { HeroIllustration } from '../../components/booking/HeroIllustration';
import { ButtonLink } from '../../components/ui/Button';
import { Accordion } from '../../components/ui/Accordion';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { RideCategoryCards } from '../pricing/RideCategoryCards';
import { driverBenefits, faqs, passengerBenefits, passengerSteps, safetyFeatures } from './content';
import { CheckList, FinalCta, SectionHeading, StepList } from './Sections';

export function HomePage() {
  useDocumentTitle('');
  return (
    <>
      <section className="bg-navy-900 text-ink">
        <div className="container-page grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-2">
          <div>
            <Badge tone="accent">Demonstration build</Badge>
            <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">Your journey. <span className="text-accent">Your way.</span></h1>
            <p className="mt-4 max-w-xl text-lg text-ink-muted">Request a ride across Johannesburg with upfront fares, clear trip updates and itemised receipts. Built for passengers and drivers alike.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink to="/register">Book a Ride</ButtonLink>
              <ButtonLink to="/register?role=driver" variant="secondary">Become a Driver</ButtonLink>
            </div>
            <div className="mt-10 hidden max-w-md lg:block"><HeroIllustration /></div>
          </div>
          <div className="mx-auto w-full max-w-md lg:max-w-none"><BookingPreview /></div>
        </div>
      </section>

      <section className="section" aria-labelledby="how">
        <div className="container-page">
          <SectionHeading eyebrow="How it works" title="From pickup to receipt in four steps" />
          <StepList steps={passengerSteps} />
        </div>
      </section>

      <section className="section bg-white" aria-labelledby="rides">
        <div className="container-page">
          <SectionHeading eyebrow="Ride options" title="A ride for every trip" intro="Four categories, each with its own capacity and rates." />
          <div className="mt-10"><RideCategoryCards /></div>
        </div>
      </section>

      <section className="section" aria-labelledby="safety">
        <div className="container-page">
          <SectionHeading eyebrow="Safety and trust" title="Built to be accountable" intro="Honest about what exists today and what is still planned." />
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {safetyFeatures.slice(0, 3).map((f) => (
              <Card key={f.title}><ShieldCheck aria-hidden className="h-7 w-7 text-success" /><h3 className="mt-3 text-lg font-bold">{f.title}</h3><p className="mt-2 text-navy-900/75">{f.text}</p></Card>
            ))}
          </div>
          <div className="mt-6"><ButtonLink to="/safety" variant="outline">See all safety details</ButtonLink></div>
        </div>
      </section>

      <section className="section bg-white">
        <div className="container-page grid gap-10 md:grid-cols-2">
          <div><h2 className="text-2xl font-bold">For passengers</h2><CheckList items={passengerBenefits} /></div>
          <div><h2 className="text-2xl font-bold">For drivers</h2><CheckList items={driverBenefits} /></div>
        </div>
      </section>

      <section className="section" aria-labelledby="faq">
        <div className="container-page max-w-3xl">
          <SectionHeading eyebrow="FAQ" title="Frequently asked questions" />
          <div className="mt-8"><Accordion items={faqs} /></div>
        </div>
      </section>

      <FinalCta title="Ready to ride, or to drive?" text="Create a free account to explore the RideWave demonstration.">
        <ButtonLink to="/register">Get Started</ButtonLink>
        <ButtonLink to="/drive-with-us" variant="secondary">Drive With Us</ButtonLink>
      </FinalCta>
    </>
  );
}
