import { ButtonLink } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { Alert } from '../../components/ui/Alert';
import { driverBenefits, driverSteps } from './content';
import { CheckList, FinalCta, PageHero, SectionHeading, StepList } from './Sections';

export function DriveWithUsPage() {
  useDocumentTitle('Drive With Us');
  return (
    <>
      <PageHero title="Drive with RideWave" intro="Accept the rides you want, see exactly how each fare is made up, and track your earnings.">
        <ButtonLink to="/register?role=driver">Become a Driver</ButtonLink>
      </PageHero>
      <section className="section"><div className="container-page">
        <SectionHeading eyebrow="Getting started" title="From sign-up to your first ride" />
        <StepList steps={driverSteps} />
      </div></section>
      <section className="section bg-white"><div className="container-page grid gap-6 md:grid-cols-3">
        <Card><h2 className="text-xl font-bold">Eligibility</h2><CheckList items={['A valid driver’s licence', 'Proof of identity and address', 'Vehicle registration and insurance documents', 'Local operating and permit requirements as they apply to e-hailing']} /></Card>
        <Card><h2 className="text-xl font-bold">Vehicle requirements</h2><CheckList items={['A roadworthy vehicle matching a ride category', 'Seating capacity as listed per category', 'Make, model, year and registration on your profile']} /></Card>
        <Card><h2 className="text-xl font-bold">How earnings work</h2><p className="mt-3 text-navy-900/80">Each trip’s fare is split into your earnings and a platform commission, shown per trip. This demonstration uses a placeholder 20% commission; a real rate would be set and made configurable by the platform before launch.</p><CheckList items={driverBenefits.slice(1, 3)} /></Card>
      </div></section>
      <section className="section"><div className="container-page max-w-3xl">
        <Alert tone="info">Documents you upload are stored privately. In this demonstration, approval is simulated and documents are not checked against real records. Confirm the legal requirements for operating in your city before launch.</Alert>
      </div></section>
      <FinalCta title="Start your application" text="Create a driver account to begin."><ButtonLink to="/register?role=driver">Become a Driver</ButtonLink></FinalCta>
    </>
  );
}
