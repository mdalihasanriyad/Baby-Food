import { Link, useSearchParams } from 'react-router-dom';
import { useLang } from '../../context/LanguageContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { usePageMeta } from '../../hooks/usePageMeta.js';
import Pagination from '../../components/Pagination.jsx';
import ProductImage from '../../components/ProductImage.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { ErrorBox, Skeleton } from '../../components/ProductGrid.jsx';

const STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

export default function Orders() {
  const { t, lang, money } = useLang();
  usePageMeta(`${t('orders.title')} | ${t('brand')}`);
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const status = STATUSES.includes(params.get('status')) ? params.get('status') : '';
  const { data, loading, error, reload } = useApi(`/orders?page=${page}&limit=10${status ? `&status=${status}` : ''}`);
  const set = (k, v) => { const n = new URLSearchParams(params); if (v) n.set(k, v); else n.delete(k); if (k !== 'page') n.delete('page'); setParams(n); };
  const date = (d) => new Date(d).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-GB', { dateStyle: 'medium' });
  const num = (n) => new Intl.NumberFormat(lang === 'bn' ? 'bn-BD' : 'en-US').format(n);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">{t('orders.title')}</h2>
        <select className="input !w-auto" aria-label={t('order.status')} value={status} onChange={(e) => set('status', e.target.value)}>
          <option value="">{t('orders.all')}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{t(`order.s.${s}`)}</option>)}
        </select>
      </div>
      <div className="mt-4">
        {error ? <ErrorBox error={error} onRetry={reload} />
          : loading && !data ? <Skeleton n={3} cls="grid gap-3" />
          : data.items.length === 0 ? <div className="rounded-2xl border border-dashed border-sky-200 p-10 text-center text-ink-soft"><p>{t('orders.empty')}</p><Link to="/shop" className="btn-primary mt-4">{t('cart.continue')}</Link></div>
          : (
            <ul className={`space-y-3 ${loading ? 'opacity-60' : ''}`}>
              {data.items.map((o) => (
                <li key={o.trackingId}>
                  <Link to={`/account/orders/${o.trackingId}`} className="block rounded-2xl border border-sky-100 p-4 hover:bg-sky-50">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-sm font-semibold">{o.trackingId}</span><StatusBadge status={o.status} />
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex -space-x-2">
                        {o.items.map((i) => <ProductImage key={i.name.en} product={{ name: i.name, images: i.image ? [{ url: i.image }] : [] }} name={i.name[lang] || i.name.en} width={96} className="h-12 w-12 rounded-lg border-2 border-white" />)}
                      </div>
                      <div className="min-w-0 flex-1 text-sm text-ink-soft"><p className="truncate">{o.items.map((i) => i.name[lang] || i.name.en).join(', ')}</p><p>{date(o.createdAt)} · {num(o.itemCount)} {t('orders.items')}</p></div>
                      <b className="text-sky-700">{money(o.total)}</b>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        {data && <Pagination page={data.page} totalPages={data.totalPages} onChange={(n) => set('page', String(n))} />}
      </div>
    </div>
  );
}
