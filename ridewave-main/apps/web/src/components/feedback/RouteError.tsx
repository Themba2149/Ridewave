import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom';

/** Router-level error boundary: catches render errors and failed lazy loads. */
export function RouteError() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  return (
    <div role="alert" className="flex min-h-screen flex-col items-center justify-center bg-navy-900 px-6 text-center text-ink">
      <h1 className="text-3xl font-bold">{notFound ? 'Page not found' : 'Something went wrong'}</h1>
      <p className="mt-2 max-w-md text-ink-muted">
        {notFound ? 'The page you are looking for does not exist.' : 'An unexpected error occurred. Reloading the page usually fixes it.'}
      </p>
      <div className="mt-6 flex gap-3">
        <button className="rounded-lg border border-white/30 px-5 py-2.5 font-semibold" onClick={() => window.location.reload()}>Reload</button>
        <Link className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-navy-900" to="/">Go home</Link>
      </div>
    </div>
  );
}
