import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAdmin } from './AdminLayout.jsx';
import { errorText } from '../../services/api.js';
import { Badge, Notice, Stat, dateOnly, dateTime, taka } from './ui.jsx';

export default function AdminCustomerDetail() {
  const { id } = useParams();
  const { call } = useAdmin();
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await call(`/customers/${id}`);
    if (r.ok) setD(r.data); else setError(errorText(r));
  }, [call, id]);
  useEffect(() => { load(); }, [load]);

  const toggle = async () => {
    const c = d.customer;
    if (c.isActive && !window.confirm(`Disable ${c.name}? They will be signed out and cannot log in.`)) return;
    setBusy(true);
    const r = await call(`/customers/${id}`, { method: 'PATCH', body: { isActive: !c.isActive } });
    setBusy(false);
    if (r.ok) setD({ ...d, customer: r.data.customer }); else setError(errorText(r));
  };

  if (!d) return <div><Notice error={error} />{!error && <p className="p-8 text-center text-ink-soft" role="status">Loading…</p>}<Link to="/admin/customers" className="text-sm font-semibold text-sky-700">← Customers</Link></div>;
  const c = d.customer;
  return (
    <div className="max-w-4xl">
      <Link to="/admin/customers" className="text-sm font-semibold text-sky-700 hover:underline">← Customers</Link>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div><h1 className="text-2xl font-bold">{c.name}</h1><p className="text-sm text-ink-soft">{c.phone}{c.email && ` · ${c.email}`} · joined {dateOnly(c.createdAt)}</p></div>
        <button className={c.isActive ? 'btn-ghost !text-red-700' : 'btn-primary'} disabled={busy} onClick={toggle}>{c.isActive ? 'Disable account' : 'Enable account'}</button>
      </div>
      <Notice error={error} />
      {!c.isActive && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700" role="status">This account is disabled: the customer cannot log in or place orders.</p>}
      <div className="mt-4 grid grid-cols-3 gap-3"><Stat label="Orders" value={c.orders} /><Stat label="Delivered" value={c.deliveredOrders} /><Stat label="Delivered spend" value={taka(c.deliveredSpend)} /></div>
      <h2 className="mt-6 text-lg font-bold">Recent orders</h2>
      <div className="mt-2 overflow-x-auto rounded-2xl border border-sky-100"><table className="w-full min-w-[480px] text-left text-sm"><tbody className="divide-y divide-sky-100">
        {d.recentOrders.length === 0 && <tr><td className="p-6 text-center text-ink-soft">No orders yet.</td></tr>}
        {d.recentOrders.map((o) => <tr key={o.trackingId}><td className="p-3"><Link to={`/admin/orders/${o.trackingId}`} className="font-mono font-semibold text-sky-700 hover:underline">{o.trackingId}</Link></td><td className="p-3">{dateTime(o.createdAt)}</td><td className="p-3">{taka(o.total)}</td><td className="p-3"><Badge status={o.status} /></td></tr>)}
      </tbody></table></div>
      <p className="mt-2 text-xs text-ink-soft">Passwords are never visible to anyone, including admins.</p>
    </div>
  );
}
