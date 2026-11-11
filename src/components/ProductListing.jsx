import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLang } from '../context/LanguageContext.jsx';
import { useApi } from '../hooks/useApi.js';
import Breadcrumbs from './Breadcrumbs.jsx';
import Pagination from './Pagination.jsx';
import ProductGrid, { ErrorBox, Skeleton } from './ProductGrid.jsx';

const SORTS = ['new', 'price_asc', 'price_desc', 'popular'];

function PriceFilter({ value, max, onCommit }) {
  const { t, money } = useLang();
  const [v, setV] = useState(value || max);
  const commit = () => onCommit(v >= max ? '' : String(v));
  return (
    <div>
      <label htmlFor="max" className="text-sm font-semibold">{t('shop.price')}: {money(v)}</label>
      <input id="max" type="range" min="50" max={max} step="50" value={v} onChange={(e) => setV(Number(e.target.value))}
        onPointerUp={commit} onKeyUp={commit} onBlur={commit} className="mt-2 w-full accent-sky-600" />
    </div>
  );
}

// Shared by Shop, category and group pages. Filter state lives in the URL, so pages are shareable.
export default function ProductListing({ title, intro, crumbs, fixed = {}, categoryGroup, showCategoryFilter = false }) {
  const { t, lang } = useLang();
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const facetsRef = useRef({ maxPrice: 0, hasPopularity: false });

  const q = params.get('q') ?? '';
  const category = fixed.category ?? params.get('category') ?? '';
  const sort = SORTS.includes(params.get('sort')) ? params.get('sort') : 'new';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const maxPrice = Number(params.get('max')) || 0;
  const inStock = params.get('stock') === '1';
  const sale = params.get('sale') === '1';

  const query = new URLSearchParams({ page: String(page), limit: '12', sort });
  if (q) query.set('q', q);
  if (fixed.group) query.set('group', fixed.group);
  if (category) query.set('category', category);
  if (maxPrice) query.set('maxPrice', String(maxPrice));
  if (inStock) query.set('inStock', '1');
  if (sale) query.set('discounted', '1');

  const { data, loading, error, reload } = useApi(`/products?${query}`);
  const catsApi = useApi(showCategoryFilter ? '/categories' : null);
  if (data?.facets) facetsRef.current = data.facets;
  const sliderMax = Math.max(100, Math.ceil(facetsRef.current.maxPrice / 50) * 50);

  const set = (key, val) => {
    const next = new URLSearchParams(params);
    if (val === '' || val === false) next.delete(key); else next.set(key, val === true ? '1' : val);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: key !== 'page' });
    if (key === 'page') window.scrollTo({ top: 0 });
  };
  const cats = (catsApi.data?.items ?? []).filter((c) => !categoryGroup || c.group === categoryGroup);

  return (
    <div className="container-x py-8">
      <Breadcrumbs items={crumbs} />
      <h1 className="mt-3 text-2xl font-bold sm:text-3xl">{title}</h1>
      {intro && <p className="mt-1 max-w-2xl text-sm text-ink-soft">{intro}</p>}
      {q && <p className="mt-2 text-sm text-ink-soft">{t('shop.search')}: “{q}” <button className="ml-2 font-semibold text-sky-700 hover:underline" onClick={() => set('q', '')}>{t('shop.clearSearch')}</button></p>}
      <p className="mt-1 text-sm text-ink-soft" role="status">
        {data ? `${new Intl.NumberFormat(lang === 'bn' ? 'bn-BD' : 'en-US').format(data.total)} ${t('shop.results')}` : '\u00a0'}
      </p>

      <button className="btn-ghost mt-4 lg:hidden" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{t('shop.filters')}</button>
      <div className="mt-4 grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className={`${open ? 'block' : 'hidden'} space-y-4 rounded-2xl border border-sky-100 p-4 lg:sticky lg:top-24 lg:block lg:self-start`} aria-label={t('shop.filters')}>
          {showCategoryFilter && (
            <div>
              <label htmlFor="cat" className="text-sm font-semibold">{t('shop.category')}</label>
              <select id="cat" className="input mt-1" value={category} onChange={(e) => set('category', e.target.value)}>
                <option value="">{t('shop.all')}</option>
                {cats.map((c) => <option key={c.slug} value={c.slug}>{c.name[lang] || c.name.en}</option>)}
              </select>
            </div>
          )}
          <div>
            <label htmlFor="sort" className="text-sm font-semibold">{t('shop.sort')}</label>
            <select id="sort" className="input mt-1" value={sort} onChange={(e) => set('sort', e.target.value === 'new' ? '' : e.target.value)}>
              <option value="new">{t('sort.new')}</option>
              <option value="price_asc">{t('sort.low')}</option>
              <option value="price_desc">{t('sort.high')}</option>
              {facetsRef.current.hasPopularity && <option value="popular">{t('sort.popular')}</option>}
            </select>
          </div>
          <PriceFilter key={`${maxPrice}-${sliderMax}`} value={maxPrice} max={sliderMax} onCommit={(v) => set('max', v)} />
          <label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5 accent-sky-600" checked={inStock} onChange={(e) => set('stock', e.target.checked)} />{t('shop.inStock')}</label>
          <label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5 accent-sky-600" checked={sale} onChange={(e) => set('sale', e.target.checked)} />{t('shop.discounted')}</label>
          <button className="btn-ghost w-full" onClick={() => setParams({}, { replace: true })}>{t('shop.reset')}</button>
        </aside>

        <div>
          {error ? <ErrorBox error={error} onRetry={reload} />
            : loading && !data ? <Skeleton n={6} cls="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3" />
            : data.items.length === 0 ? <div className="rounded-2xl border border-dashed border-sky-200 p-10 text-center text-ink-soft">{t('shop.empty')}</div>
            : <div className={loading ? 'opacity-60 transition-opacity' : ''}><ProductGrid items={data.items} cls="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3" /></div>}
          {data && <Pagination page={data.page} totalPages={data.totalPages} onChange={(n) => set('page', String(n))} />}
          {data?.items.some((p) => p.isDemo) && <p className="mt-6 rounded-xl bg-butter p-3 text-sm" role="note">{t('demo.note')}</p>}
        </div>
      </div>
    </div>
  );
}
