import { ButtonLink } from '../../components/ui/Button';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

export function NotFoundPage() {
  useDocumentTitle('Page not found');
  return (
    <section className="container-page section text-center">
      <h1 className="text-4xl font-bold">Page not found</h1>
      <p className="mt-3 text-navy-900/75">The page you are looking for does not exist.</p>
      <div className="mt-6"><ButtonLink to="/" variant="dark">Back to home</ButtonLink></div>
    </section>
  );
}
