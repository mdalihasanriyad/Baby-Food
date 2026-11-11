import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api.js';
import { useNoIndex } from '../../hooks/useNoIndex.js';

// Admin screens are English-only and share no chrome or session with the storefront.
export default function AdminLogin() {
  useNoIndex();
  const navigate = useNavigate();
  const [form, setForm] = useState({ identifier: '', password: '' });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg('');
    const r = await api('/admin/auth/login', { method: 'POST', body: form });
    setBusy(false);
    if (r.ok) navigate('/admin/dashboard', { replace: true });
    else if (r.network) setMsg('Network problem. Check your connection.');
    else if (r.status === 429) setMsg('Too many failed attempts. Try again later.');
    else setMsg('Incorrect email/phone or password.');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-sky-50 p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border border-sky-200 bg-white p-6 shadow-frame">
        <h1 className="text-xl font-bold text-sky-700">Baby Food Gallery — Admin</h1>
        <div><label htmlFor="ai" className="text-sm font-semibold">Email or phone</label>
          <input id="ai" className="input mt-1" autoComplete="username" value={form.identifier} onChange={(e) => setForm({ ...form, identifier: e.target.value })} /></div>
        <div><label htmlFor="ap" className="text-sm font-semibold">Password</label>
          <input id="ap" type="password" className="input mt-1" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
        {msg && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{msg}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}
