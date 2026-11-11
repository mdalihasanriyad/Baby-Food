import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLang } from '../context/LanguageContext.jsx';
import { useApi } from '../hooks/useApi.js';
import { usePageMeta } from '../hooks/usePageMeta.js';
import ProductListing from '../components/ProductListing.jsx';
import { ErrorBox, Skeleton } from '../components/ProductGrid.jsx';

// Works for any category an admin creates.
export default function CategoryPage() {
  const { slug } = useParams();
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const { data, loading, error, url, reload } = useApi(`/categories/${slug}`);

  useEffect(() => { // an old slug was redirected by the API: move to the new URL
    if (data && url) {
      const finalSlug = new URL(url).pathname.split('/').pop();
      if (finalSlug && finalSlug !== slug) navigate(`/category/${finalSlug}`, { replace: true });
    }
  }, [data, url, slug, navigate]);

  const cat = data?.item;
  const title = cat ? cat.name[lang] || cat.name.en : '';
  usePageMeta(cat ? `${title} | ${t('brand')}` : null, cat?.description?.[lang] || cat?.description?.en);

  if (error === 'notfound') {
    return <div className="container-x py-20 text-center"><h1 className="text-2xl font-bold">{t('nf.title')}</h1><p className="mt-2 text-ink-soft">{t('nf.body')}</p><Link to="/shop" className="btn-primary mt-6">{t('shop.title')}</Link></div>;
  }
  if (error) return <div className="container-x py-10"><ErrorBox error={error} onRetry={reload} /></div>;
  if (loading || !cat) return <div className="container-x py-10"><Skeleton n={4} /></div>;
  const crumbs = [{ label: t('bc.home'), to: '/' }];
  if (cat.group === 'baby' || cat.group === 'adult') crumbs.push({ label: t(`group.${cat.group}`), to: cat.group === 'baby' ? '/baby-food' : '/adult-food' });
  crumbs.push({ label: title });
  return <ProductListing key={cat.slug} title={title} intro={cat.description?.[lang] || cat.description?.en} fixed={{ category: cat.slug }} crumbs={crumbs} />;
}
