import { Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext.jsx';
import { useApi } from '../hooks/useApi.js';
import { usePageMeta } from '../hooks/usePageMeta.js';
import ProductGrid, { ErrorBox, Skeleton } from '../components/ProductGrid.jsx';

const frames = [
  { tone: 'bg-butter', cls: 'translate-y-4', key: 'baby-cereals' },
  { tone: 'bg-sky-100', cls: '-translate-y-2', key: 'baby-milk-formula' },
  { tone: 'bg-blush', cls: 'translate-y-6', key: 'baby-biscuits-snacks' },
];
const tones = ['bg-mint', 'bg-sky-100', 'bg-butter', 'bg-blush'];

function Section({ title, to, items }) {
  const { t } = useLang();
  if (!items?.length) return null;
  return (
    <section className="container-x mt-14">
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2 className="text-xl font-bold sm:text-2xl">{title}</h2>
        {to && <Link to={to} className="text-sm font-semibold text-sky-700 hover:underline">{t('home.viewAll')}</Link>}
      </div>
      <ProductGrid items={items} />
    </section>
  );
}

export default function Home() {
  const { t, lang } = useLang();
  usePageMeta(`${t('brand')} | ${t('hero.title')}`, t('hero.body'));
  const { data, loading, error, reload } = useApi('/home');
  const name = (c) => c.name[lang] || c.name.en;
  const heroLabel = (i) => data?.categories?.[i] ? name(data.categories[i]) : '';

  return (
    <>
      <section className="bg-sky-50">
        <div className="container-x grid items-center gap-8 py-10 md:grid-cols-2 md:py-16">
          <div>
            <h1 className="text-3xl font-bold leading-tight text-ink sm:text-4xl">{t('hero.title')}</h1>
            <p className="mt-4 max-w-md text-ink-soft">{t('hero.body')}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/shop" className="btn-primary">{t('hero.cta')}</Link>
              <a href="#categories" className="btn-ghost">{t('hero.cta2')}</a>
            </div>
          </div>
          <div className="grid grid-cols-3 items-center gap-3" aria-hidden="true">
            {frames.map((f, i) => (
              <div key={f.key} className={`mat ${f.cls}`}>
                <div className={`flex aspect-[3/4] items-end rounded-xl p-2 ${f.tone}`}><span className="text-xs font-semibold text-sky-700/80">{heroLabel(i)}</span></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-x mt-8 grid gap-3 sm:grid-cols-3">
        {[['trust.cod', 'trust.codBody'], ['trust.delivery', 'trust.deliveryBody'], ['trust.care', 'trust.careBody']].map(([h, b]) => (
          <div key={h} className="rounded-2xl border border-sky-100 p-4"><h2 className="font-semibold text-sky-700">{t(h)}</h2><p className="mt-1 text-sm text-ink-soft">{t(b)}</p></div>
        ))}
      </section>

      {error && <div className="container-x mt-10"><ErrorBox error={error} onRetry={reload} /></div>}
      {loading && !data && <div className="container-x mt-10"><Skeleton n={4} /></div>}

      {data && (
        <>
          <Section title={t('home.featured')} to="/shop" items={data.featured} />
          <section id="categories" className="container-x mt-14 scroll-mt-20">
            <h2 className="mb-4 text-xl font-bold sm:text-2xl">{t('home.categories')}</h2>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {data.categories.map((c, i) => (
                <li key={c.slug}><Link to={`/category/${c.slug}`} className={`flex min-h-[72px] items-center rounded-2xl p-4 font-semibold text-ink hover:ring-2 hover:ring-sky-300 ${tones[i % tones.length]}`}>{name(c)}</Link></li>
              ))}
            </ul>
          </section>
          <Section title={t('home.baby')} to="/baby-food" items={data.baby} />
          <Section title={t('home.adult')} to="/adult-food" items={data.adult} />
          <Section title={t('home.sale')} to="/shop?sale=1" items={data.onSale} />
          <Section title={t('home.new')} to="/shop" items={data.newArrivals} />
          {[...data.featured, ...data.newArrivals, ...data.baby, ...data.adult, ...data.onSale].some((p) => p.isDemo) && (
            <p className="container-x mt-10 rounded-xl bg-butter p-3 text-sm" role="note">{t('demo.note')}</p>
          )}
        </>
      )}
    </>
  );
}
