import { useEffect, useState } from 'react';
import { useAdmin } from './AdminLayout.jsx';
import { errorText } from '../../services/api.js';
import { Notice } from './ui.jsx';

export default function AdminSettings() {
  const { call } = useAdmin();
  const [f, setF] = useState(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    call('/settings').then((r) => {
      if (!r.ok) { setError(errorText(r)); return; }
      const s = r.data.settings;
      setF({ inside: String(s.delivery.insideDhaka), outside: String(s.delivery.outsideDhaka), threshold: String(s.lowStockThreshold), pixel: s.metaPixelId, ...s.contact, aboutBn: s.about.bn, aboutEn: s.about.en });
    });
  }, [call]);

  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const T = (label, k, props = {}, hint) => <label className="text-sm font-semibold">{label}<input className="input mt-1" value={f[k]} onChange={set(k)} {...props} />{hint && <span className="mt-1 block text-xs font-normal text-ink-soft">{hint}</span>}</label>;

  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setError(''); setOk('');
    const r = await call('/settings', { method: 'PATCH', body: {
      delivery: { insideDhaka: Number(f.inside), outsideDhaka: Number(f.outside) },
      lowStockThreshold: Number(f.threshold), metaPixelId: f.pixel.trim(),
      contact: { phone: f.phone, whatsapp: f.whatsapp, email: f.email, address: f.address, facebook: f.facebook, instagram: f.instagram },
      about: { bn: f.aboutBn, en: f.aboutEn },
    } });
    setBusy(false);
    if (r.ok) setOk('Settings saved.'); else setError(errorText(r));
  };

  if (!f) return <div><Notice error={error} />{!error && <p className="p-8 text-center text-ink-soft" role="status">Loading…</p>}</div>;
  return (
    <form onSubmit={save} className="grid max-w-3xl gap-4 sm:grid-cols-2" noValidate>
      <h1 className="text-2xl font-bold sm:col-span-2">Store settings</h1>
      <div className="sm:col-span-2"><Notice error={error} ok={ok} /></div>

      <h2 className="border-b border-sky-100 pb-1 text-lg font-bold sm:col-span-2">Delivery charges (whole taka)</h2>
      {T('Inside Dhaka (৳)', 'inside', { type: 'number', min: 0, step: 1 })}{T('Outside Dhaka (৳)', 'outside', { type: 'number', min: 0, step: 1 })}
      <p className="text-xs text-ink-soft sm:col-span-2">New fees apply to <b>new orders only</b>. Existing orders keep the fee they were placed with. Customers always see the current fee before they order.</p>

      <h2 className="border-b border-sky-100 pb-1 text-lg font-bold sm:col-span-2">Inventory</h2>
      {T('Low-stock threshold', 'threshold', { type: 'number', min: 0, step: 1 }, 'Products at or below this number appear in “Low stock” and are labelled “Low stock” in the shop.')}

      <h2 className="border-b border-sky-100 pb-1 text-lg font-bold sm:col-span-2">Contact details (shown on the website and invoices)</h2>
      {T('Phone', 'phone')}{T('WhatsApp', 'whatsapp')}{T('Email', 'email', { type: 'email' })}{T('Address', 'address')}
      {T('Facebook page URL', 'facebook', { placeholder: 'https://…' })}{T('Instagram URL', 'instagram', { placeholder: 'https://…' })}

      <h2 className="border-b border-sky-100 pb-1 text-lg font-bold sm:col-span-2">About us</h2>
      <label className="text-sm font-semibold">Bengali<textarea rows="5" className="input mt-1" value={f.aboutBn} onChange={set('aboutBn')} /></label>
      <label className="text-sm font-semibold">English<textarea rows="5" className="input mt-1" value={f.aboutEn} onChange={set('aboutEn')} /></label>

      <h2 className="border-b border-sky-100 pb-1 text-lg font-bold sm:col-span-2">Facebook Pixel</h2>
      {T('Pixel ID (digits only; leave empty to keep tracking off)', 'pixel', { inputMode: 'numeric' }, 'Used from Phase 9, and only after the visitor consents.')}

      <div className="sm:col-span-2"><button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</button></div>
    </form>
  );
}
