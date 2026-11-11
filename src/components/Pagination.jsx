import { useLang } from '../context/LanguageContext.jsx';

export default function Pagination({ page, totalPages, onChange }) {
  const { t } = useLang();
  if (totalPages <= 1) return null;
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const pages = Array.from({ length: Math.min(5, totalPages) }, (_, i) => start + i);
  return (
    <nav className="mt-8 flex flex-wrap items-center justify-center gap-1" aria-label="Pagination">
      <button className="btn-ghost" disabled={page <= 1} onClick={() => onChange(page - 1)}>{t('shop.prev')}</button>
      {pages.map((n) => (
        <button key={n} onClick={() => onChange(n)} aria-current={n === page ? 'page' : undefined}
          className={`inline-flex h-11 min-w-11 items-center justify-center rounded-xl px-3 text-sm font-semibold ${n === page ? 'bg-sky-600 text-white' : 'text-sky-700 hover:bg-sky-50'}`}>{n}</button>
      ))}
      <button className="btn-ghost" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>{t('shop.next')}</button>
    </nav>
  );
}
