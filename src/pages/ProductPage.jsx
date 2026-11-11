import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLang } from '../context/LanguageContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useApi } from '../hooks/useApi.js';
import { usePageMeta } from '../hooks/usePageMeta.js';
import { imgUrl } from '../utils/img.js';
import { addToCart, viewContent } from '../services/pixel.js';
import Breadcrumbs from '../components/Breadcrumbs.jsx';
import ProductImage from '../components/ProductImage.jsx';
import ProductGrid, { ErrorBox, Skeleton } from '../components/ProductGrid.jsx';
import ReviewSection from '../components/ReviewSection.jsx';
import Stars from '../components/Stars.jsx';
import WishlistButton from '../components/WishlistButton.jsx';

const MAX_QTY = 50;

export default function ProductPage() {
  const { slug } = useParams();
  const { t, lang, money } = useLang();
  const navigate = useNavigate();
  const cart = useCart();
  const { data, loading, error, url, reload } = useApi(`/products/${slug}`);
  const p = data?.item;
  const related = useApi(p ? `/products/${p.slug}/related` : null);
  const [shot, setShot] = useState(0);
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');

  useEffect(() => { // an old slug was redirected (301) by the API: move to the new URL
    if (p && url) {
      const finalSlug = new URL(url).pathname.split('/').pop();
      if (finalSlug && finalSlug !== slug) navigate(`/product/${finalSlug}`, { replace: true });
    }
  }, [p, url, slug, navigate]);
  useEffect(() => { setShot(0); setQty(1); setNote(''); }, [slug]);
  useEffect(() => { if (p) viewContent(p); }, [p?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const name = p ? p.name[lang] || p.name.en : '';
  const text = (o) => o?.[lang] || o?.en || o?.bn || '';
  usePageMeta(p ? (p.seo?.title || `${name} | ${t('brand')}`) : null, p ? (p.seo?.metaDescription || text(p.description)) : null);

  if (error === 'notfound') {
    return <div className="container-x py-20 text-center"><h1 className="text-2xl font-bold">{t('product.notFound')}</h1><p className="mt-2 text-ink-soft">{t('product.notFoundBody')}</p><Link to="/shop" className="btn-primary mt-6">{t('shop.title')}</Link></div>;
  }
  if (error) return <div className="container-x py-10"><ErrorBox error={error} onRetry={reload} /></div>;
  if (loading || !p) return <div className="container-x py-10"><Skeleton n={2} cls="grid gap-4 sm:grid-cols-2" /></div>;

  const out = p.stock <= 0;
  const limit = Math.min(p.stock, MAX_QTY);
  const off = p.salePrice ? Math.round(((p.price - p.salePrice) / p.price) * 100) : 0;
  const stockKey = out ? 'product.out' : p.stock <= 10 ? 'product.low' : 'product.in';
  const images = p.images ?? [];
  const clamp = (n) => Math.max(1, Math.min(limit || 1, Number.isFinite(n) ? n : 1));

  const add = () => {
    const r = cart.add(p, qty);
    if (r.ok) addToCart(p, qty);
    setNote(r.capped ? t('product.maxReached') : t('product.addedToCart'));
  };
  const buyNow = () => { // add, then go straight to checkout (login is requested there if needed)
    if (cart.add(p, qty).ok) { addToCart(p, qty); navigate('/checkout'); }
  };
  const share = async () => {
    const link = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: name, url: link });
      else { await navigator.clipboard.writeText(link); setNote(t('product.copied')); }
    } catch { /* user cancelled */ }
  };

  const crumbs = [{ label: t('bc.home'), to: '/' }];
  const cat = p.category;
  if (cat?.group === 'baby' || cat?.group === 'adult') crumbs.push({ label: t(`group.${cat.group}`), to: cat.group === 'baby' ? '/baby-food' : '/adult-food' });
  if (cat) crumbs.push({ label: text(cat.name), to: `/category/${cat.slug}` });
  crumbs.push({ label: name });

  const sections = [
    ['product.description', text(p.description)],
    ['product.ingredients', text(p.details?.ingredients)], // shown only if the admin supplied verified text
    ['product.age', text(p.details?.ageInfo)],
    ['product.other', text(p.details?.other)],
  ].filter(([, v]) => v);

  return (
    <div className="container-x py-6">
      <Breadcrumbs items={crumbs} />
      <div className="mt-4 grid gap-8 md:grid-cols-2">
        <div>
          <div className="mat">
            <ProductImage product={{ ...p, images: images.slice(shot, shot + 1) }} name={name} width={800} eager className="aspect-square w-full rounded-xl" />
          </div>
          {images.length > 1 && (
            <ul className="mt-3 flex gap-2 overflow-x-auto" aria-label="Gallery">
              {images.map((im, i) => (
                <li key={im.url}>
                  <button onClick={() => setShot(i)} aria-label={`${name} ${i + 1}`} aria-current={i === shot}
                    className={`block h-16 w-16 overflow-hidden rounded-lg border-2 ${i === shot ? 'border-sky-600' : 'border-transparent'}`}>
                    <img src={imgUrl(im.url, 128)} alt="" loading="lazy" width="64" height="64" className="h-full w-full object-cover" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {p.isDemo && <p className="mt-3 rounded-xl bg-butter p-3 text-xs" role="note">{t('demo.note')}</p>}
        </div>

        <div>
          {p.brand && <p className="text-sm text-ink-soft">{p.brand}</p>}
          <h1 className="text-2xl font-bold leading-snug sm:text-3xl">{name}</h1>
          {p.ratingCount > 0 && <a href="#reviews-h" className="mt-1 inline-flex items-center gap-2 text-sm"><Stars value={p.ratingAverage} size={18} /> {p.ratingAverage} ({p.ratingCount})</a>}

          <div className="mt-4 flex flex-wrap items-baseline gap-3">
            <span className="text-3xl font-bold text-sky-700">{money(p.effectivePrice)}</span>
            {p.salePrice && <s className="text-lg text-ink-soft">{money(p.price)}</s>}
            {off > 0 && <span className="rounded-md bg-sky-600 px-2 py-0.5 text-sm font-bold text-white">{off}% {t('product.off')}</span>}
          </div>
          {p.salePrice && <p className="mt-1 text-sm text-emerald-700">{t('product.youSave')} {money(p.price - p.salePrice)}</p>}

          <p className={`mt-3 text-sm font-semibold ${out ? 'text-red-700' : p.stock <= 10 ? 'text-amber-700' : 'text-emerald-700'}`}>
            {t(stockKey)}{!out && p.stock <= 10 && ` · ${t('product.left').replace('{n}', new Intl.NumberFormat(lang === 'bn' ? 'bn-BD' : 'en-US').format(p.stock))}`}
          </p>

          {!out && (
            <div className="mt-4 flex items-center gap-3">
              <label htmlFor="qty" className="text-sm font-semibold">{t('product.qty')}</label>
              <div className="flex items-center rounded-xl border border-sky-200">
                <button type="button" className="h-11 w-11 text-lg" aria-label="-" onClick={() => setQty((q) => clamp(q - 1))} disabled={qty <= 1}>−</button>
                <input id="qty" type="number" inputMode="numeric" min="1" max={limit} value={qty} onChange={(e) => setQty(clamp(parseInt(e.target.value, 10)))} className="h-11 w-14 border-x border-sky-200 text-center" />
                <button type="button" className="h-11 w-11 text-lg" aria-label="+" onClick={() => setQty((q) => clamp(q + 1))} disabled={qty >= limit}>+</button>
              </div>
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            <button className="btn-primary flex-1 sm:flex-none" disabled={out} onClick={add}>{t('product.add')}</button>
            <button className="btn-ghost flex-1 sm:flex-none" disabled={out} onClick={buyNow}>{t('product.buyNow')}</button>
            <WishlistButton productId={p._id} withLabel className="border border-sky-200 px-3" />
            <button className="btn-ghost" onClick={share}>{t('product.share')}</button>
          </div>
          <p className="mt-1 min-h-5 text-sm text-sky-700" role="status">{note}</p>

          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-ink-soft">{t('product.sku')}</dt><dd>{p.sku}</dd>
            {cat && <><dt className="text-ink-soft">{t('product.category')}</dt><dd><Link className="text-sky-700 hover:underline" to={`/category/${cat.slug}`}>{text(cat.name)}</Link></dd></>}
          </dl>
        </div>
      </div>

      {sections.length > 0 && (
        <div className="mt-10 space-y-6">
          {sections.map(([k, v]) => <section key={k}><h2 className="text-lg font-bold">{t(k)}</h2><p className="mt-1 whitespace-pre-line text-ink-soft">{v}</p></section>)}
        </div>
      )}

      <ReviewSection slug={p.slug} average={p.ratingAverage} count={p.ratingCount} />

      {related.data?.items.length > 0 && (
        <section className="mt-14"><h2 className="mb-4 text-xl font-bold">{t('product.related')}</h2><ProductGrid items={related.data.items.slice(0, 4)} /></section>
      )}
    </div>
  );
}
