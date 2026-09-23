import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { usePermissions } from '../hooks/usePermissions';
import { Spinner } from './ui/primitives';

/** Blocks access until authenticated; supports permission checks. */
export default function ProtectedRoute({ permission, children }) {
  const authReady = useStore((s) => s.authReady);
  const profile = useStore((s) => s.profile);
  const location = useLocation();
  const { can } = usePermissions();

  if (!authReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!profile) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (permission && !can(permission)) {
    return <Navigate to="/app" replace />;
  }

  return children ?? <Outlet />;
}
