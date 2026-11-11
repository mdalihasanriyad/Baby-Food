import { Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext.jsx';
import { useNoIndex } from '../hooks/useNoIndex.js';

export default function NotFound() {
  useNoIndex();
  const { t } = useLang();
  return (
    <div className="container-x py-20 text-center">
      <h1 className="text-2xl font-bold">{t('nf.title')}</h1>
      <p className="mt-2 text-ink-soft">{t('nf.body')}</p>
      <Link to="/" className="btn-primary mt-6">{t('nf.home')}</Link>
    </div>
  );
}
