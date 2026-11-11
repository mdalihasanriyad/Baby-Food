import { useEffect, useState } from 'react';
import { useLang } from '../context/LanguageContext.jsx';

export default function OfflineBanner() {
  const { t } = useLang();
  const [online, setOnline] = useState(() => navigator.onLine !== false);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  if (online) return null;
  return <div role="status" className="sticky top-0 z-50 bg-amber-100 px-4 py-2 text-center text-sm font-semibold text-amber-900">{t('net.offline')}</div>;
}
