import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { safetyFeatures } from './content';
import { PageHero } from './Sections';

export function SafetyPage() {
  useDocumentTitle('Safety');
  return (
    <>
      <PageHero title="Safety at RideWave" intro="What we are building to keep trips accountable, and what exists in this demonstration today." />
      <section className="section"><div className="container-page space-y-8">
        <Alert tone="warning">
          <strong>In an emergency, contact the emergency services directly.</strong> In South Africa, call 10111 (police) or 112 from a mobile phone. RideWave does not connect to emergency services and has no in-app emergency button.
        </Alert>
        <div className="grid gap-5 md:grid-cols-2">
          {safetyFeatures.map((f) => (
            <Card key={f.title}>
              <div className="flex items-start justify-between gap-3"><h2 className="text-lg font-bold">{f.title}</h2><Badge tone={f.status.startsWith('Available') ? 'success' : 'warning'}>{f.status}</Badge></div>
              <p className="mt-2 text-navy-900/75">{f.text}</p>
            </Card>
          ))}
        </div>
        <p className="max-w-3xl text-navy-900/75">RideWave does not currently perform real background checks or identity verification. Any such process will be described here only once it is operating.</p>
      </div></section>
    </>
  );
}
