import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { PageLoading } from '../../components/feedback/PageLoading';
import { Alert } from '../../components/ui/Alert';
import { homePathFor, useCurrentUser, type Role } from './useAuth';

/**
 * Frontend route guard for a better experience only. Real authorisation is enforced by the API on every request.
 */
export function RequireRole({ role }: { role: Role }) {
  const { data: user, isLoading, isError, error } = useCurrentUser();
  const location = useLocation();

  if (isLoading) return <PageLoading />;
  if (isError) return <div className="container-page py-16"><Alert tone="error">{error.message}</Alert></div>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (user.role !== role) return <Navigate to={homePathFor(user.role)} replace />;
  return <Outlet />;
}
