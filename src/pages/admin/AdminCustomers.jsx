import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdmin } from './AdminLayout.jsx';
import { errorText } from '../../services/api.js';
import { Notice, Pager, dateOnly, taka } from './ui.jsx';

export default function AdminCustomers() {
  const { call } = useAdmin();
  const [q, setQ] = useState('');
  const [qInput, setQInput] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const p = new URLSearchParams({ page: String(page), limit: '20' });
    if (q) p.set('q', q);
    const r = await call(`/customers?${p}`);
    if (r.ok) { setData(r.data); setError(''); } else setError(errorText(r));
  }, [call, q, page]);
  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <h1 className="text-2xl font-bold">Customers</h1>
      <form className="mt-4 flex gap-2" role="search" onSubmit={(e) => { e.preventDefault(); setQ(qInput.trim()); setPage(1); }}>
        <input className="input !w-72" placeholder="Name, phone or email" aria-label="Search customers" value={qInput} onChange={(e) => setQInput(e.target.value)} />
        <button className="btn-primary">Search</button>
      </form>
      <Notice error={error} />
      <div className="mt-4 overflow-x-auto rounded-2xl border border-sky-100">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-sky-50 text-xs uppercase text-ink-soft"><tr><th className="p-3">Customer</th><th className="p-3">Joined</th><th className="p-3">Orders</th><th className="p-3">Delivered spend</th><th className="p-3">Last order</th><th className="p-3">Account</th></tr></thead>
          <tbody className="divide-y divide-sky-100">
            {!data && <tr><td className="p-6 text-center text-ink-soft" colSpan="6">Loading…</td></tr>}
            {data?.items.length === 0 && <tr><td className="p-6 text-center text-ink-soft" colSpan="6">No customers found.</td></tr>}
            {data?.items.map((c) => (
              <tr key={c.id} className="hover:bg-sky-50">
                <td className="p-3"><Link to={`/admin/customers/${c.id}`} className="font-semibold text-sky-700 hover:underline">{c.name}</Link><div className="text-xs text-ink-soft">{c.phone}{c.email && ` · ${c.email}`}</div></td>
                <td className="p-3">{dateOnly(c.createdAt)}</td><td className="p-3">{c.orders}</td><td className="p-3">{taka(c.deliveredSpend)}</td><td className="p-3">{dateOnly(c.lastOrderAt)}</td>
                <td className="p-3">{c.isActive ? <span className="text-emerald-700">Active</span> : <span className="text-red-700">Disabled</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager data={data} onPage={setPage} />
    </div>
  );
}
