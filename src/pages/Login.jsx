import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useLang } from '../context/LanguageContext.jsx';
import { useNoIndex } from '../hooks/useNoIndex.js';
import Field from '../components/Field.jsx';

export default function Login() {
  useNoIndex();
  const { t } = useLang();
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const from = useLocation().state?.from || '/account';
  const [form, setForm] = useState({ identifier: '', password: '' });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={from} replace />;

  const submit = async (e) => {
    e.preventDefault();
    if (!form.identifier.trim() || !form.password) { setMsg('auth.v.required'); return; }
    setBusy(true); setMsg('');
    const r = await login(form.identifier.trim(), form.password);
    setBusy(false);
    if (r.ok) navigate(from, { replace: true });
    else if (r.network) setMsg('auth.network');
    else if (r.status === 429) setMsg('auth.tooMany');
    else if (r.status === 401) setMsg('auth.invalid');
    else if (r.status === 400) setMsg('auth.invalid');
    else setMsg('auth.error');
  };

  return (
    <div className="container-x max-w-md py-10">
      <h1 className="text-2xl font-bold">{t('auth.login')}</h1>
      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <Field id="li" label={t('auth.identifier')}>
          <input id="li" className="input mt-1" autoComplete="username" maxLength={254} value={form.identifier} onChange={(e) => setForm({ ...form, identifier: e.target.value })} />
        </Field>
        <Field id="lp" label={t('auth.password')}>
          <input id="lp" type="password" className="input mt-1" autoComplete="current-password" maxLength={200} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        {msg && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{t(msg)}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? t('auth.submitting') : t('auth.login')}</button>
      </form>
      <p className="mt-4 text-sm text-ink-soft">{t('auth.noAccount')} <Link to="/register" className="font-semibold text-sky-700 hover:underline">{t('auth.register')}</Link></p>
    </div>
  );
}
