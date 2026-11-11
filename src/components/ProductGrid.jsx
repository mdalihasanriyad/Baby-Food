import { useLang } from '../context/LanguageContext.jsx';
import ProductCard from './ProductCard.jsx';

export const GRID = 'grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4';

export function Skeleton({ n = 4, cls = GRID }) {
  return (
    <div className={cls} aria-hidden="true">
      {Array.from({ length: n }, (_, i) => <div key={i} className="mat animate-pulse"><div className="aspect-square rounded-xl bg-sky-100" /><div className="m-2 h-4 w-3/4 rounded bg-sky-100" /><div className="m-2 h-4 w-1/2 rounded bg-sky-100" /></div>)}
    </div>
  );
}

export function ErrorBox({ error, onRetry }) {
  const { t } = useLang();
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center" role="alert">
      <p className="text-red-800">{error === 'network' ? t('common.offline') : t('common.error')}</p>
      {onRetry && <button className="btn-ghost mt-3" onClick={onRetry}>{t('common.retry')}</button>}
    </div>
  );
}

export default function ProductGrid({ items, cls = GRID }) {
  return <div className={cls}>{items.map((p) => <ProductCard key={p._id} product={p} />)}</div>;
}
