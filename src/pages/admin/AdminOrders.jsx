import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdmin } from './AdminLayout.jsx';
import { errorText } from '../../services/api.js';
import { Badge, Notice, Pager, RangePicker, dateTime, defaultRange, rangeQs, rangeReady, taka } from './ui.jsx';

const STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

export default function AdminOrders() {
  const { call } = useAdmin();
  const [f, setF] = useState({ q: '', status: '', paymentStatus: '', deliveryZone: '', sort: 'new', page: 1 });
  const [range, setRange] = useState(defaultRange('all'));
  const [qInput, setQInput] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!rangeReady(range)) return;
    const p = new URLSearchParams(rangeQs(range));
    Object.entries(f).forEach(([k, v]) => { if (v !== '') p.set(k, v); });
    const r = await call(`/orders?${p}`);
    if (r.ok) { setData(r.data); setError(''); } else setError(errorText(r));
  }, [call, f, range]);
  useEffect(() => { load(); }, [load]);

  const set = (k, v) => setF((s) => ({ ...s, [k]: v, page: 1 }));
  const sel = (label, k, opts) => (
    <select className="input" aria-label={label} value={f[k]} onChange={(e) => set(k, e.target.value)}>
      <option value="">{label}: any</option>{opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );

  return (
    <div>
      <h1 className="text-2xl font-bold">Orders</h1>
      <form className="mt-4 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); set('q', qInput.trim()); }} role="search">
        <input className="input !w-64" placeholder="Tracking no., name or phone" aria-label="Search" value={qInput} onChange={(e) => setQInput(e.target.value)} />
        <button className="btn-primary">Search</button>
        {sel('Status', 'status', STATUSES.map((s) => [s, s]))}
        {sel('Payment', 'paymentStatus', [['unpaid', 'Unpaid'], ['collected', 'Collected']])}
        {sel('Area', 'deliveryZone', [['inside_dhaka', 'Inside Dhaka'], ['outside_dhaka', 'Outside Dhaka']])}
        <select className="input" aria-label="Sort" value={f.sort} onChange={(e) => set('sort', e.target.value)}>
          <option value="new">Newest first</option><option value="old">Oldest first</option><option value="total_desc">Highest total</option><option value="total_asc">Lowest total</option>
        </select>
      </form>
      <div className="mt-3"><RangePicker value={range} onChange={(r) => { setRange(r); setF((s) => ({ ...s, page: 1 })); }} /></div>
      <Notice error={error} />

      <div className="mt-4 overflow-x-auto rounded-2xl border border-sky-100">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-sky-50 text-xs uppercase text-ink-soft"><tr><th className="p-3">Order</th><th className="p-3">Customer</th><th className="p-3">Placed</th><th className="p-3">Total</th><th className="p-3">Status</th><th className="p-3">Payment (COD)</th></tr></thead>
          <tbody className="divide-y divide-sky-100">
            {!data && <tr><td className="p-6 text-center text-ink-soft" colSpan="6">Loading…</td></tr>}
            {data?.items.length === 0 && <tr><td className="p-6 text-center text-ink-soft" colSpan="6">No orders match these filters.</td></tr>}
            {data?.items.map((o) => (
              <tr key={o.trackingId} className="hover:bg-sky-50">
                <td className="p-3"><Link to={`/admin/orders/${o.trackingId}`} className="font-mono font-semibold text-sky-700 hover:underline">{o.trackingId}</Link><div className="text-xs text-ink-soft">{o.itemCount} items · {o.deliveryZone === 'inside_dhaka' ? 'Inside Dhaka' : 'Outside Dhaka'}</div></td>
                <td className="p-3">{o.customer.name}<div className="text-xs text-ink-soft">{o.customer.phone} · {o.customer.district}</div></td>
                <td className="p-3">{dateTime(o.createdAt)}</td>
                <td className="p-3 font-semibold">{taka(o.total)}</td>
                <td className="p-3"><Badge status={o.status} /></td>
                <td className="p-3">{o.paymentStatus === 'collected' ? <span className="text-emerald-700">Collected</span> : <span className="text-ink-soft">Unpaid</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager data={data} onPage={(p) => setF((s) => ({ ...s, page: p }))} />
    </div>
  );
}
