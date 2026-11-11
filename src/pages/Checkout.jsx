import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useLang } from '../context/LanguageContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { api } from '../services/api.js';
import { useApi } from '../hooks/useApi.js';
import { useQuote } from '../hooks/useQuote.js';
import { getAttribution } from '../services/attribution.js';
import { initiateCheckout } from '../services/pixel.js';
import { clearCheckoutKey, getCheckoutKey } from '../services/checkoutKey.js';
import { useNoIndex } from '../hooks/useNoIndex.js';
import { usePageMeta } from '../hooks/usePageMeta.js';
import Field from '../components/Field.jsx';
import Totals from '../components/Totals.jsx';
import ZonePicker from '../components/ZonePicker.jsx';
import { ErrorBox } from '../components/ProductGrid.jsx';

const PHONE_RE = /^(?:\+?88)?01[3-9]\d{8}$/;

export default function Checkout() {
  useNoIndex();
  const { t, lang, money } = useLang();
  usePageMeta(`${t('checkout.title')} | ${t('brand')}`);
  const { user } = useAuth();
  const cart = useCart();
  const navigate = useNavigate();
  const cfg = useApi('/checkout/config');
  const quote = useQuote(cart.items, cart.zone);
  const [f, setF] = useState({ name: user?.name ?? '', phone: user?.phone ?? '', district: cart.zone === 'inside_dhaka' ? 'dhaka' : '', area: '', address: '' });
  const [errors, setErrors] = useState({});
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false); // blocks a second click before React re-renders
  const tracked = useRef(false);
  useEffect(() => { // once per checkout visit, when the server-priced cart is known
    if (quote.data && !quote.data.blocked && !tracked.current) { tracked.current = true; initiateCheckout(quote.data); }
  }, [quote.data]);

  if (cart.items.length === 0) return <Navigate to="/cart" replace />;

  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const err = (k) => (errors[k] ? t(`checkout.v.${errors[k]}`) : undefined);
  const districts = (cfg.data?.districts ?? []).filter((d) => (cart.zone === 'inside_dhaka' ? d.value === 'dhaka' : d.value !== 'dhaka'));

  const changeZone = (z) => { // Inside Dhaka = the Dhaka district; Outside = any other district
    cart.setZone(z);
    setF((s) => ({ ...s, district: z === 'inside_dhaka' ? 'dhaka' : s.district === 'dhaka' ? '' : s.district }));
  };

  const validate = () => {
    const e = {};
    if (f.name.trim().length < 2) e.name = 'name_short';
    if (!PHONE_RE.test(f.phone.replace(/[\s-]/g, ''))) e.phone = 'phone_invalid';
    if (!f.district) e.district = 'invalid';
    if (f.address.trim().length < 5) e.address = 'address_short';
    return e;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (lock.current) return;
    const local = validate();
    setErrors(local); setMsg('');
    if (Object.keys(local).length) return;
    if (!quote.data || quote.data.blocked) { setMsg('checkout.stockChanged'); return; }

    lock.current = true; setBusy(true);
    const r = await api('/orders', {
      method: 'POST',
      body: {
        items: cart.items.map(({ productId, quantity }) => ({ productId, quantity })),
        customer: { name: f.name.trim(), phone: f.phone.trim(), district: f.district, area: f.area.trim() || undefined, address: f.address.trim() },
        deliveryZone: cart.zone, paymentMethod: 'cod', idempotencyKey: getCheckoutKey(), attribution: getAttribution(),
      },
    });
    setBusy(false);

    if (r.ok) {
      clearCheckoutKey(); cart.clear();
      navigate(`/account/orders/${r.data.order.trackingId}?placed=1`, { replace: true });
      return; // lock stays on: this page is done
    }
    lock.current = false;
    const code = r.data?.error?.code;
    if (r.network) setMsg('checkout.network');
    else if (r.status === 401) navigate('/login', { state: { from: '/checkout' } });
    else if (r.status === 429) setMsg('auth.tooMany');
    else if (r.status === 409 && (code === 'STOCK_CHANGED' || code === 'PRODUCT_UNAVAILABLE')) { setMsg('checkout.stockChanged'); quote.reload(); }
    else if (r.status === 400) {
      const map = {};
      for (const d of r.data?.error?.details ?? []) map[d.field.replace(/^customer\./, '')] = d.message;
      setErrors(map); setMsg(Object.keys(map).length ? '' : 'auth.error');
    } else setMsg('auth.error');
  };

  const q = quote.data;
  return (
    <div className="container-x py-8">
      <h1 className="text-2xl font-bold sm:text-3xl">{t('checkout.title')}</h1>
      <form onSubmit={submit} noValidate className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="space-y-4 rounded-2xl border border-sky-100 p-4">
            <h2 className="font-bold">{t('checkout.contact')}</h2>
            <Field id="cn" label={t('checkout.name')} error={err('name')}><input id="cn" className="input mt-1" autoComplete="name" maxLength={80} value={f.name} onChange={set('name')} /></Field>
            <Field id="cp" label={t('checkout.phone')} error={err('phone')}><input id="cp" type="tel" inputMode="tel" className="input mt-1" autoComplete="tel" maxLength={16} value={f.phone} onChange={set('phone')} /></Field>
          </section>

          <section className="space-y-4 rounded-2xl border border-sky-100 p-4">
            <h2 className="font-bold">{t('checkout.delivery')}</h2>
            <ZonePicker zone={cart.zone} onChange={changeZone} fees={cfg.data?.delivery} name="checkoutzone" />
            <Field id="cd" label={t('checkout.district')} error={err('district')} hint={cart.zone === 'inside_dhaka' ? t('checkout.insideNote') : undefined}>
              <select id="cd" className="input mt-1" value={f.district} onChange={set('district')}>
                {cart.zone !== 'inside_dhaka' && <option value="">{t('checkout.districtChoose')}</option>}
                {districts.map((d) => <option key={d.value} value={d.value}>{lang === 'bn' ? d.bn : d.en}</option>)}
              </select>
            </Field>
            <Field id="ca" label={t('checkout.area')}><input id="ca" className="input mt-1" maxLength={80} value={f.area} onChange={set('area')} /></Field>
            <Field id="cf" label={t('checkout.address')} error={err('address')}><textarea id="cf" rows="3" className="input mt-1" maxLength={300} value={f.address} onChange={set('address')} /></Field>
          </section>

          <section className="rounded-2xl border border-sky-100 p-4">
            <h2 className="font-bold">{t('checkout.payment')}</h2>
            <label className="mt-3 flex min-h-[44px] items-center gap-2 rounded-xl border border-sky-600 bg-sky-50 p-3 text-sm">
              <input type="radio" checked readOnly className="accent-sky-600" /><span><b>{t('checkout.cod')}</b><br /><span className="text-ink-soft">{t('checkout.codNote')}</span></span>
            </label>
          </section>
        </div>

        <aside className="h-fit space-y-4 rounded-2xl border border-sky-100 p-4 lg:sticky lg:top-24">
          <h2 className="font-bold">{t('checkout.summary')}</h2>
          {quote.error ? <ErrorBox error={quote.error} onRetry={quote.reload} /> : !q ? <p className="text-sm text-ink-soft" role="status">{t('cart.updating')}</p> : (
            <>
              <ul className="space-y-2 text-sm">
                {q.lines.filter((l) => l.allowedQuantity > 0).map((l) => (
                  <li key={l.productId} className="flex justify-between gap-3"><span>{l.name[lang] || l.name.en} × {l.allowedQuantity}</span><span>{money(l.lineTotal)}</span></li>
                ))}
              </ul>
              <Totals quote={q} />
              <p className="text-xs text-ink-soft">{t('checkout.feeNote')}</p>
              {q.blocked && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{t('checkout.stockChanged')} <Link to="/cart" className="font-semibold underline">{t('checkout.backToCart')}</Link></p>}
            </>
          )}
          {msg && (
            <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">
              {t(msg)} {msg === 'checkout.stockChanged' && <Link to="/cart" className="font-semibold underline">{t('checkout.backToCart')}</Link>}
            </p>
          )}
          <button className="btn-primary w-full" disabled={busy || quote.loading || !q || q.blocked}>{busy ? t('checkout.placing') : t('checkout.place')}</button>
        </aside>
      </form>
    </div>
  );
}
