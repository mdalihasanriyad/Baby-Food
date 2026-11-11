import { useState } from 'react';
import { useLang } from '../context/LanguageContext.jsx';

const PHONE_RE = /^(?:\+?88)?01[3-9]\d{8}$/;

export default function Contact() {
  const { t } = useLang();
  const [form, setForm] = useState({ name: '', phone: '', message: '', website: '' });
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error | network

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (form.name.trim().length < 2) errs.name = 'contact.v.name';
    if (!PHONE_RE.test(form.phone.trim())) errs.phone = 'contact.v.phone';
    if (form.message.trim().length < 10) errs.message = 'contact.v.message';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setStatus('sending');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) { setStatus('sent'); setForm({ name: '', phone: '', message: '', website: '' }); return; }
      if (res.status === 400) {
        // The server is the source of truth; map its field errors back onto the form.
        const data = await res.json().catch(() => ({}));
        const map = {};
        for (const d of data?.error?.details ?? []) if (['name', 'phone', 'message'].includes(d.field)) map[d.field] = `contact.v.${d.field}`;
        setErrors(map);
      }
      setStatus('error');
    } catch {
      setStatus('network');
    }
  };

  const field = (id, key, label, input) => (
    <div>
      <label htmlFor={id} className="text-sm font-semibold">{label}</label>
      {input}
      {errors[key] && <p id={`${id}-err`} className="mt-1 text-xs text-red-700" role="alert">{t(errors[key])}</p>}
    </div>
  );

  return (
    <div className="container-x grid gap-8 py-10 md:grid-cols-2">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{t('contact.title')}</h1>
        <p className="mt-4 rounded-xl bg-sky-50 p-4 text-sm text-ink-soft">{t('contact.placeholderInfo')}</p>
      </div>
      <form className="space-y-4" onSubmit={submit} noValidate>
        {field('n', 'name', t('contact.name'), <input id="n" className="input mt-1" autoComplete="name" maxLength={80} value={form.name} onChange={set('name')} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'n-err' : undefined} />)}
        {field('p', 'phone', t('contact.phone'), <input id="p" type="tel" inputMode="tel" className="input mt-1" autoComplete="tel" maxLength={16} value={form.phone} onChange={set('phone')} aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? 'p-err' : undefined} />)}
        {field('m', 'message', t('contact.message'), <textarea id="m" rows="4" className="input mt-1" maxLength={1000} value={form.message} onChange={set('message')} aria-invalid={Boolean(errors.message)} aria-describedby={errors.message ? 'm-err' : undefined} />)}
        {/* Honeypot: hidden from people and assistive tech; bots tend to fill it */}
        <div className="absolute -left-[9999px]" aria-hidden="true">
          <input tabIndex={-1} autoComplete="off" name="website" value={form.website} onChange={set('website')} />
        </div>
        <button type="submit" className="btn-primary" disabled={status === 'sending'}>{status === 'sending' ? t('contact.sending') : t('contact.send')}</button>
        <p role="status" className={`text-sm ${status === 'sent' ? 'text-emerald-700' : 'text-red-700'}`}>
          {status === 'sent' && t('contact.sent')}
          {status === 'error' && t('contact.error')}
          {status === 'network' && t('contact.network')}
        </p>
      </form>
    </div>
  );
}
