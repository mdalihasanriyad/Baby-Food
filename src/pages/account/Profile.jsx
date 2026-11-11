import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLang } from '../../context/LanguageContext.jsx';
import { api, fieldErrors } from '../../services/api.js';
import Field from '../../components/Field.jsx';

const PHONE_RE = /^(?:\+?88)?01[3-9]\d{8}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ProfileForm() {
  const { t } = useLang();
  const { user, refresh } = useAuth();
  const [f, setF] = useState({ name: user.name, phone: user.phone, email: user.email ?? '', currentPassword: '' });
  const [errors, setErrors] = useState({});
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const err = (k) => (errors[k] ? t(`auth.v.${errors[k]}`) : undefined);
  const identityChanged = f.phone.replace(/[\s-]/g, '').replace(/^\+?88/, '') !== user.phone || f.email.trim().toLowerCase() !== (user.email ?? '');

  const submit = async (e) => {
    e.preventDefault();
    const local = {};
    if (f.name.trim().length < 2) local.name = 'name_short';
    if (!PHONE_RE.test(f.phone.replace(/[\s-]/g, ''))) local.phone = 'phone_invalid';
    if (f.email.trim() && !EMAIL_RE.test(f.email.trim())) local.email = 'email_invalid';
    if (identityChanged && !f.currentPassword) local.currentPassword = 'password_required';
    setErrors(local); setMsg('');
    if (Object.keys(local).length) return;
    setBusy(true);
    const r = await api('/account/profile', { method: 'PATCH', body: { name: f.name.trim(), phone: f.phone.trim(), email: f.email.trim(), currentPassword: f.currentPassword || undefined } });
    setBusy(false);
    if (r.ok) { await refresh(); setF((s) => ({ ...s, currentPassword: '' })); setMsg('profile.saved'); }
    else if (r.network) setMsg('common.offline');
    else if (r.status === 429) setMsg('auth.tooMany');
    else if (r.status === 400 || r.status === 409) setErrors(fieldErrors(r));
    else setMsg('auth.error');
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4 rounded-2xl border border-sky-100 p-4">
      <h2 className="text-lg font-bold">{t('acct.profile')}</h2>
      <Field id="pn" label={t('auth.name')} error={err('name')}><input id="pn" className="input mt-1" autoComplete="name" maxLength={80} value={f.name} onChange={set('name')} /></Field>
      <Field id="pp" label={t('auth.phone')} error={err('phone')}><input id="pp" type="tel" inputMode="tel" className="input mt-1" autoComplete="tel" maxLength={16} value={f.phone} onChange={set('phone')} /></Field>
      <Field id="pe" label={t('auth.email')} error={err('email')}><input id="pe" type="email" className="input mt-1" autoComplete="email" maxLength={254} value={f.email} onChange={set('email')} /></Field>
      {identityChanged && (
        <Field id="pc" label={t('profile.currentPw')} error={err('currentPassword')} hint={t('profile.currentPwNote')}>
          <input id="pc" type="password" className="input mt-1" autoComplete="current-password" maxLength={200} value={f.currentPassword} onChange={set('currentPassword')} />
        </Field>
      )}
      {msg && <p className={`text-sm ${msg === 'profile.saved' ? 'text-emerald-700' : 'text-red-700'}`} role="status">{t(msg)}</p>}
      <button className="btn-primary" disabled={busy}>{busy ? t('auth.submitting') : t('profile.save')}</button>
    </form>
  );
}

function PasswordForm() {
  const { t } = useLang();
  const blank = { currentPassword: '', newPassword: '', confirmPassword: '' };
  const [f, setF] = useState(blank);
  const [errors, setErrors] = useState({});
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const err = (k) => (errors[k] ? t(`auth.v.${errors[k]}`) : undefined);

  const submit = async (e) => {
    e.preventDefault();
    const local = {};
    if (!f.currentPassword) local.currentPassword = 'required';
    if (f.newPassword.length < 8) local.newPassword = 'password_short';
    else if (!/\p{L}/u.test(f.newPassword) || !/\p{N}/u.test(f.newPassword)) local.newPassword = 'password_weak';
    else if (f.newPassword === f.currentPassword) local.newPassword = 'password_same';
    if (f.confirmPassword !== f.newPassword) local.confirmPassword = 'password_mismatch';
    setErrors(local); setMsg('');
    if (Object.keys(local).length) return;
    setBusy(true);
    const r = await api('/account/password', { method: 'POST', body: f });
    setBusy(false);
    if (r.ok) { setF(blank); setMsg('profile.pwSaved'); }
    else if (r.network) setMsg('common.offline');
    else if (r.status === 429) setMsg('auth.tooMany');
    else if (r.status === 400) setErrors(fieldErrors(r));
    else setMsg('auth.error');
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4 rounded-2xl border border-sky-100 p-4">
      <h2 className="text-lg font-bold">{t('profile.pwTitle')}</h2>
      <Field id="wc" label={t('profile.currentPw')} error={err('currentPassword')}><input id="wc" type="password" className="input mt-1" autoComplete="current-password" maxLength={200} value={f.currentPassword} onChange={set('currentPassword')} /></Field>
      <Field id="wn" label={t('profile.newPw')} error={err('newPassword')} hint={t('auth.passwordHint')}><input id="wn" type="password" className="input mt-1" autoComplete="new-password" maxLength={72} value={f.newPassword} onChange={set('newPassword')} /></Field>
      <Field id="wf" label={t('auth.confirm')} error={err('confirmPassword')}><input id="wf" type="password" className="input mt-1" autoComplete="new-password" maxLength={72} value={f.confirmPassword} onChange={set('confirmPassword')} /></Field>
      {msg && <p className={`text-sm ${msg === 'profile.pwSaved' ? 'text-emerald-700' : 'text-red-700'}`} role="status">{t(msg)}</p>}
      <button className="btn-primary" disabled={busy}>{busy ? t('auth.submitting') : t('profile.pwBtn')}</button>
    </form>
  );
}

export default function Profile() {
  return <div className="grid max-w-3xl gap-6"><ProfileForm /><PasswordForm /></div>;
}
