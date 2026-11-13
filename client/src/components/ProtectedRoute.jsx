import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Blocks unauthenticated users, and optionally users without a given role.
 * Renders nested routes through <Outlet />.
 */
export default function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="page-loader" role="status">
        <span className="spinner" />
        Loading your dashboard…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (role && user.role !== role) {
    return <Navigate to="/" replace />;
  }

  return children ?? <Outlet />;
}
