import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useLang } from '../context/LanguageContext.jsx';

// UX only. Real protection is enforced by the server on every API request.
export default function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const { t } = useLang();
  const location = useLocation();
  if (loading) return <div className="container-x py-20 text-center text-ink-soft" role="status">{t('auth.loading')}</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}
