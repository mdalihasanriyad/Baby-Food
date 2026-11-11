import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useApi } from '../hooks/useApi.js';
import { useQuote } from '../hooks/useQuote.js';
import { useNoIndex } from '../hooks/useNoIndex.js';
import { usePageMeta } from '../hooks/usePageMeta.js';
import ProductImage from '../components/ProductImage.jsx';
import Totals from '../components/Totals.jsx';
import ZonePicker from '../components/ZonePicker.jsx';
import { ErrorBox, Skeleton } from '../components/ProductGrid.jsx';

export default function Cart() {
  useNoIndex();
  const { t, lang, money } = useLang();
  usePageMeta(`${t('cart.title')} | ${t('brand')}`);
  const cart = useCart();
  const cfg = useApi('/checkout/config');
  const quote = useQuote(cart.items, cart.zone);
  const [notice, setNotice] = useState('');
  const { setQuantity } = cart;

  // The server is the source of truth: if stock is lower than the cart quantity, lower the cart to match.
  useEffect(() => {
    const adj = quote.data?.lines.filter((l) => l.status === 'adjusted') ?? [];
    if (adj.length) {
      adj.forEach((l) => setQuantity(l.productId, l.allowedQuantity));
      setNotice(adj.map((l) => `${l.name[lang] || l.name.en}: ${t('cart.adjusted').replace('{n}', l.allowedQuantity)}`).join(' '));
    }
  }, [quote.data, setQuantity, lang, t]);

  if (cart.items.length === 0) {
    return (
      <div className="container-x py-20 text-center">
        <h1 className="text-2xl font-bold">{t('cart.empty')}</h1>
        <p className="mt-2 text-ink-soft">{t('cart.emptyBody')}</p>
        <Link to="/shop" className="btn-primary mt-6">{t('cart.continue')}</Link>
      </div>
    );
  }

  const q = quote.data;
  const payable = q && q.lines.some((l) => l.allowedQuantity > 0);
  const canCheckout = q && !q.blocked && payable && !quote.loading;

  return (
    <div className="container-x py-8">
      <h1 className="text-2xl font-bold sm:text-3xl">{t('cart.title')}</h1>
      {notice && <p className="mt-3 rounded-xl bg-butter p-3 text-sm" role="status">{notice}</p>}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div>
          {quote.error ? <ErrorBox error={quote.error} onRetry={quote.reload} />
            : !q ? <Skeleton n={2} cls="grid gap-3" />
            : (
              <ul className={`divide-y divide-sky-100 rounded-2xl border border-sky-100 ${quote.loading ? 'opacity-60' : ''}`}>
                {q.lines.map((l) => {
                  const bad = l.status === 'unavailable' || l.status === 'out_of_stock';
                  const name = l.name ? l.name[lang] || l.name.en : '';
                  return (
                    <li key={l.productId} className="flex gap-3 p-3 sm:gap-4">
                      {!bad && <ProductImage product={{ name: l.name, images: l.image ? [{ url: l.image }] : [] }} name={name} width={160} className="h-20 w-20 shrink-0 rounded-xl" />}
                      <div className="min-w-0 flex-1">
                        {bad && l.status === 'unavailable' ? <p className="font-semibold text-red-700">{t('cart.unavailable')}</p>
                          : <Link to={`/product/${l.slug}`} className="font-semibold hover:text-sky-700">{name}</Link>}
                        {l.status === 'out_of_stock' && <p className="text-sm text-red-700">{t('cart.outOfStock')}</p>}
                        {!bad && (
                          <>
                            <p className="mt-1 text-sm text-ink-soft">{t('cart.unit')}: <b className="text-ink">{money(l.unitPrice)}</b> {l.listPrice > l.unitPrice && <s>{money(l.listPrice)}</s>}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-3">
                              <div className="flex items-center rounded-xl border border-sky-200">
                                <button className="h-11 w-11 text-lg" aria-label="-" disabled={l.quantity <= 1} onClick={() => cart.setQuantity(l.productId, l.quantity - 1)}>−</button>
                                <span className="w-10 text-center" aria-live="polite">{l.allowedQuantity}</span>
                                <button className="h-11 w-11 text-lg" aria-label="+" disabled={l.allowedQuantity >= Math.min(l.stock, 50)} onClick={() => cart.setQuantity(l.productId, l.quantity + 1)}>+</button>
                              </div>
                              <b className="ml-auto text-sky-700">{money(l.lineTotal)}</b>
                            </div>
                          </>
                        )}
                      </div>
                      <button className="self-start text-sm font-semibold text-red-700 hover:underline" onClick={() => cart.remove(l.productId)}>{t('cart.remove')}</button>
                    </li>
                  );
                })}
              </ul>
            )}
        </div>

        <aside className="h-fit space-y-4 rounded-2xl border border-sky-100 p-4 lg:sticky lg:top-24">
          <ZonePicker zone={cart.zone} onChange={cart.setZone} fees={cfg.data?.delivery} name="cartzone" />
          {q ? <Totals quote={q} /> : <p className="text-sm text-ink-soft" role="status">{t('cart.updating')}</p>}
          {canCheckout ? <Link to="/checkout" className="btn-primary w-full">{t('cart.checkout')}</Link>
            : <button className="btn-primary w-full" disabled>{t('cart.checkout')}</button>}
          <p className="text-xs text-ink-soft">{t('cart.priceNote')}</p>
          <Link to="/shop" className="block text-center text-sm font-semibold text-sky-700 hover:underline">{t('cart.continue')}</Link>
        </aside>
      </div>
    </div>
  );
}
