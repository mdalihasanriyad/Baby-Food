import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLang } from '../../context/LanguageContext.jsx';
import { useCart } from '../../context/CartContext.jsx';
import { api } from '../../services/api.js';
import { useApi } from '../../hooks/useApi.js';
import { trackPurchaseOnce } from '../../services/pixel.js';
import OrderTimeline from '../../components/OrderTimeline.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import Totals from '../../components/Totals.jsx';
import ProductImage from '../../components/ProductImage.jsx';
import { ErrorBox, Skeleton } from '../../components/ProductGrid.jsx';

export default function OrderDetail() {
  const { trackingId } = useParams();
  const [params] = useSearchParams();
  const { t, lang, money } = useLang();
  const cart = useCart();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useApi(`/orders/${trackingId}`);
  const [updated, setUpdated] = useState(null); // the order as returned by the cancel call
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const placed = params.get('placed') === '1';
  const loaded = data?.order;
  useEffect(() => { if (placed && loaded) trackPurchaseOnce(loaded); }, [placed, loaded]); // only right after checkout, once per order

  const back = <Link to="/account/orders" className="text-sm font-semibold text-sky-700 hover:underline">← {t('orders.back')}</Link>;
  if (error === 'notfound') return <div className="py-10 text-center"><h2 className="text-xl font-bold">{t('order.notFound')}</h2><div className="mt-4">{back}</div></div>;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const o = updated ?? data?.order;
  if (loading || !o) return <Skeleton n={2} cls="grid gap-4" />;

  const cancel = async () => {
    setBusy(true); setMsg('');
    const r = await api(`/orders/${o.trackingId}/cancel`, { method: 'POST', body: { reason: reason.trim() || undefined } });
    setBusy(false);
    if (r.ok) { setUpdated(r.data.order); setConfirming(false); setMsg('orders.cancelled'); }
    else if (r.network) setMsg('common.offline');
    else if (r.status === 409) { setMsg('orders.cannotCancel'); setConfirming(false); reload(); }
    else setMsg('auth.error');
  };

  const reorder = () => { // the cart page re-checks price and stock with the server
    o.items.forEach((i) => cart.add({ _id: i.productId, stock: 50 }, i.quantity));
    navigate('/cart');
  };

  return (
    <div className="max-w-3xl">
      {back}
      {params.get('placed') === '1' && <p className="mt-3 rounded-xl bg-mint p-4 text-center font-semibold" role="status">{t('order.thanks')}</p>}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div><p className="text-sm text-ink-soft">{t('order.id')}</p><p className="select-all font-mono text-lg font-bold">{o.trackingId}</p></div>
        <StatusBadge status={o.status} />
      </div>
      {msg && <p className={`mt-3 rounded-xl p-3 text-sm ${msg === 'orders.cancelled' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`} role="status">{t(msg)}</p>}

      <section className="mt-6 rounded-2xl border border-sky-100 p-4"><h3 className="mb-3 font-bold">{t('orders.track')}</h3><OrderTimeline order={o} /></section>

      <section className="mt-4 rounded-2xl border border-sky-100 p-4">
        <h3 className="font-bold">{t('order.items')}</h3>
        <ul className="mt-2 divide-y divide-sky-100 text-sm">
          {o.items.map((i) => (
            <li key={i.productId} className="flex items-center gap-3 py-2">
              <ProductImage product={{ name: i.name, images: i.image ? [{ url: i.image }] : [] }} name={i.name[lang] || i.name.en} width={96} className="h-12 w-12 shrink-0 rounded-lg" />
              <span className="flex-1">{i.name[lang] || i.name.en} <span className="text-ink-soft">× {i.quantity}</span><br /><span className="text-xs text-ink-soft">{money(i.unitPrice)}</span></span>
              <b>{money(i.lineTotal)}</b>
            </li>
          ))}
        </ul>
        <div className="mt-3"><Totals quote={o} /></div>
      </section>

      <section className="mt-4 rounded-2xl border border-sky-100 p-4 text-sm">
        <h3 className="font-bold">{t('order.deliveryTo')}</h3>
        <p className="mt-1">{o.customer.name} · {o.customer.phone}</p>
        <p className="text-ink-soft">{o.customer.address}{o.customer.area ? `, ${o.customer.area}` : ''}, {o.customer.district}</p>
        <p className="mt-2 text-ink-soft">{t('order.cod')}</p>
      </section>

      <div className="mt-6 flex flex-wrap gap-3">
        <button className="btn-primary" onClick={reorder}>{t('orders.reorder')}</button>
        {o.canCancel && !confirming && <button className="btn-ghost !text-red-700" onClick={() => setConfirming(true)}>{t('orders.cancel')}</button>}
      </div>
      {o.canCancel && <p className="mt-2 text-xs text-ink-soft">{t('orders.cancelRule')}</p>}

      {confirming && (
        <div className="mt-4 space-y-3 rounded-2xl border border-red-200 bg-red-50 p-4" role="alertdialog" aria-label={t('orders.cancel')}>
          <p className="font-semibold">{t('orders.cancelConfirm')}</p>
          <label className="block text-sm">{t('orders.cancelReason')}<textarea rows="2" maxLength={200} className="input mt-1" value={reason} onChange={(e) => setReason(e.target.value)} /></label>
          <div className="flex gap-2">
            <button className="btn-primary !bg-red-600 hover:!bg-red-700" disabled={busy} onClick={cancel}>{busy ? t('auth.submitting') : t('orders.cancelYes')}</button>
            <button className="btn-ghost" disabled={busy} onClick={() => setConfirming(false)}>{t('orders.cancelNo')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
