import { Link } from 'react-router-dom';
import { useLang } from '../../context/LanguageContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import ProductImage from '../../components/ProductImage.jsx';
import Stars from '../../components/Stars.jsx';
import { ErrorBox, Skeleton } from '../../components/ProductGrid.jsx';

export default function MyReviews() {
  const { t, lang } = useLang();
  const { data, loading, error, reload } = useApi('/account/reviews');
  const pic = (name, image) => ({ name, images: image ? [{ url: image }] : [] });
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (loading || !data) return <Skeleton n={2} cls="grid gap-3" />;

  return (
    <div className="max-w-3xl space-y-8">
      <section>
        <h2 className="text-xl font-bold">{t('myrev.toReview')}</h2>
        {data.reviewable.length === 0 ? <p className="mt-2 text-sm text-ink-soft">{t('rev.notEligible')}</p> : (
          <ul className="mt-3 space-y-2">
            {data.reviewable.map((r) => (
              <li key={r.productId} className="flex items-center gap-3 rounded-2xl border border-sky-100 p-3">
                <ProductImage product={pic(r.name, r.image)} name={r.name[lang] || r.name.en} width={96} className="h-12 w-12 shrink-0 rounded-lg" />
                <span className="flex-1 text-sm font-semibold">{r.name[lang] || r.name.en}</span>
                <Link to={`/product/${r.slug}#reviews-h`} className="btn-ghost">{t('myrev.write')}</Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2 className="text-xl font-bold">{t('myrev.title')}</h2>
        {data.reviews.length === 0 ? <p className="mt-2 text-sm text-ink-soft">{t('myrev.none')}</p> : (
          <ul className="mt-3 space-y-2">
            {data.reviews.map((r) => (
              <li key={r.id} className="rounded-2xl border border-sky-100 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Link to={`/product/${r.product.slug}`} className="text-sm font-semibold hover:text-sky-700">{r.product.name[lang] || r.product.name.en}</Link>
                  <Stars value={r.rating} />
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : r.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{t(`myrev.s.${r.status}`)}</span>
                </div>
                {r.comment && <p className="mt-1 whitespace-pre-line text-sm">{r.comment}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
