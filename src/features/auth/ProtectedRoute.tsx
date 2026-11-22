import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { Spinner } from '@/components/common/Spinner';
import { ROLE_HOME, type UserRole } from '@/types';

/** UI guard only. Real enforcement is Row Level Security in the database (Stage 2). */
export function ProtectedRoute({ role }: { role: UserRole }) {
  const { session, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner fullScreen label="Loading your account" />;
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!profile) return <Navigate to="/login" replace />;
  if (profile.role !== role) return <Navigate to={ROLE_HOME[profile.role]} replace />;
  return <Outlet />;
}
