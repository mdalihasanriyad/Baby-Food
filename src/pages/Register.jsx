import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useLang } from '../context/LanguageContext.jsx';
import { fieldErrors } from '../services/api.js';
import { useNoIndex } from '../hooks/useNoIndex.js';
import Field from '../components/Field.jsx';

const PHONE_RE = /^(?:\+?88)?01[3-9]\d{8}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(f) {
  const e = {};
  if (f.name.trim().length < 2) e.name = 'name_short';
  if (!PHONE_RE.test(f.phone.replace(/[\s-]/g, ''))) e.phone = 'phone_invalid';
  if (f.email.trim() && !EMAIL_RE.test(f.email.trim())) e.email = 'email_invalid';
  if (f.password.length < 8) e.password = 'password_short';
  else if (!/\p{L}/u.test(f.password) || !/\p{N}/u.test(f.password)) e.password = 'password_weak';
  if (f.confirmPassword !== f.password) e.confirmPassword = 'password_mismatch';
  return e;
}

export default function Register() {
  useNoIndex();
  const { t } = useLang();
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', phone: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/account" replace />;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const err = (k) => (errors[k] ? t(`auth.v.${errors[k]}`) : undefined);

  const submit = async (e) => {
    e.preventDefault();
    const local = validate(form);
    setErrors(local); setMsg('');
    if (Object.keys(local).length) return;
    setBusy(true);
    const r = await register({ ...form, name: form.name.trim(), email: form.email.trim() });
    setBusy(false);
    if (r.ok) { navigate('/account', { replace: true }); return; }
    if (r.network) setMsg('auth.network');
    else if (r.status === 429) setMsg('auth.tooMany');
    else if (r.status === 400 || r.status === 409) setErrors(fieldErrors(r));
    else setMsg('auth.error');
  };

  const text = (id, key, type = 'text', extra = {}) => (
    <input id={id} type={type} className="input mt-1" value={form[key]} onChange={set(key)}
      aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `${id}-err` : undefined} {...extra} />
  );

  return (
    <div className="container-x max-w-md py-10">
      <h1 className="text-2xl font-bold">{t('auth.register')}</h1>
      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <Field id="rn" label={t('auth.name')} error={err('name')}>{text('rn', 'name', 'text', { autoComplete: 'name', maxLength: 80 })}</Field>
        <Field id="rp" label={t('auth.phone')} error={err('phone')}>{text('rp', 'phone', 'tel', { autoComplete: 'tel', inputMode: 'tel', maxLength: 16 })}</Field>
        <Field id="re" label={t('auth.email')} error={err('email')}>{text('re', 'email', 'email', { autoComplete: 'email', maxLength: 254 })}</Field>
        <Field id="rw" label={t('auth.password')} error={err('password')} hint={t('auth.passwordHint')}>{text('rw', 'password', 'password', { autoComplete: 'new-password', maxLength: 72 })}</Field>
        <Field id="rc" label={t('auth.confirm')} error={err('confirmPassword')}>{text('rc', 'confirmPassword', 'password', { autoComplete: 'new-password', maxLength: 72 })}</Field>
        {msg && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{t(msg)}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? t('auth.submitting') : t('auth.register')}</button>
      </form>
      <p className="mt-4 text-sm text-ink-soft">{t('auth.haveAccount')} <Link to="/login" className="font-semibold text-sky-700 hover:underline">{t('auth.login')}</Link></p>
    </div>
  );
}
