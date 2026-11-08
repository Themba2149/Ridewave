import { Alert } from '../../components/ui/Alert';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { PageHero } from './Sections';

const content = {
  terms: { title: 'Terms of Service', points: ['Using RideWave means agreeing to these terms once final versions are published.', 'This demonstration does not book real trips or take real payments.', 'Accounts must not be shared, and users must provide accurate information.', 'Drivers are responsible for meeting local licensing and operating requirements.'] },
  privacy: { title: 'Privacy Policy', points: ['We collect only the information needed to run the service, such as account details, trip details and support messages.', 'Driver documents are stored privately and are visible only to authorised reviewers.', 'Passwords are stored only as one-way hashes. Payment card numbers are never stored.', 'A data retention and deletion policy will be published before any real launch, in line with applicable law such as POPIA.'] },
};

export function LegalPage({ kind }: { kind: keyof typeof content }) {
  const c = content[kind];
  useDocumentTitle(c.title);
  return (
    <>
      <PageHero title={c.title} intro="Draft summary for the demonstration build." />
      <section className="section"><div className="container-page max-w-3xl space-y-6">
        <Alert tone="warning">Draft placeholder, not legal advice. A qualified lawyer must review and replace this before any public launch.</Alert>
        <ul className="list-disc space-y-3 pl-6 text-navy-900/85">{c.points.map((p) => <li key={p}>{p}</li>)}</ul>
      </div></section>
    </>
  );
}
export const TermsPage = () => <LegalPage kind="terms" />;
export const PrivacyPage = () => <LegalPage kind="privacy" />;
