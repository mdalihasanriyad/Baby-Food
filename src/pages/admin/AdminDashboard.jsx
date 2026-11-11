import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdmin } from './AdminLayout.jsx';
import { errorText } from '../../services/api.js';
import { BarChart, Badge, Explain, Notice, RULES, RangePicker, Stat, dateTime, defaultRange, rangeQs, rangeReady, taka } from './ui.jsx';

export default function AdminDashboard() {
  const { call } = useAdmin();
  const [range, setRange] = useState(defaultRange('last30'));
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!rangeReady(range)) return undefined;
    let alive = true;
    setLoading(true);
    call(`/dashboard?${rangeQs(range)}`).then((r) => {
      if (!alive) return;
      setLoading(false);
      if (r.ok) { setData(r.data); setError(''); } else setError(errorText(r));
    });
    return () => { alive = false; };
  }, [call, range]);

  const s = data?.summary;
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-bold">Dashboard</h1>{data && <p className="text-sm text-ink-soft">{data.range.from ?? 'Beginning'} → {data.range.to} (Bangladesh time)</p>}</div>
        <RangePicker value={range} onChange={setRange} />
      </div>
      <Notice error={error} />
      {!data && loading && <p className="mt-8 text-center text-ink-soft" role="status">Loading…</p>}

      {data && (
        <div className={loading ? 'opacity-60 transition-opacity' : ''}>
          <h2 className="mt-6 text-lg font-bold">Orders placed in this period</h2>
          <div className="mt-2 grid grid-cols-2 gap-3 lg:grid-cols-6">
            <Stat label="Total orders" value={s.orders.total} />
            <Stat label="Pending" value={s.orders.pending} tone="bg-amber-50" />
            <Stat label="Confirmed / processing" value={s.orders.confirmedProcessing} />
            <Stat label="Shipped" value={s.orders.shipped} />
            <Stat label="Delivered" value={s.orders.delivered} tone="bg-emerald-50" />
            <Stat label="Cancelled" value={s.orders.cancelled} tone="bg-red-50" />
          </div>

          <h2 className="mt-8 text-lg font-bold">Money</h2>
          <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Delivered sales" value={taka(s.money.deliveredSales)} hint={`${s.orders.delivered} delivered orders. The only figure that counts as revenue.`} tone="bg-emerald-50" />
            <Stat label="Open orders (not revenue yet)" value={taka(s.money.openOrderValue)} hint={`${s.orders.open} awaiting delivery, of which pending ${taka(s.money.pendingValue)}`} tone="bg-amber-50" />
            <Stat label="Cancelled value" value={taka(s.money.cancelledValue)} hint={`${s.orders.cancelled} cancelled orders`} tone="bg-red-50" />
            <Stat label="Gross order value" value={taka(s.money.grossOrderValue)} hint="Delivered + open + cancelled" />
            <Stat label="Delivery charges (delivered)" value={taka(s.money.deliveryCharges)} hint="Included in delivered sales" />
            <Stat label="Discounts given (delivered)" value={taka(s.money.discountsGiven)} hint="Already deducted from prices" />
            <Stat label="Estimated profit" value={data.profit.estimatedProfit === null ? '—' : taka(data.profit.estimatedProfit)}
              hint={data.profit.estimatedProfit === null ? 'Set cost prices on products to see an estimate' : `Based on ${data.profit.coveragePercent}% of delivered product revenue (items with a cost price)`} />
          </div>

          <h2 className="mt-8 text-lg font-bold">Trend ({data.trend.granularity === 'day' ? 'by day' : 'by month'})</h2>
          <p className="text-xs text-ink-soft"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-sky-200" /> all orders placed &nbsp; <span className="inline-block h-2.5 w-2.5 rounded-sm bg-sky-600" /> delivered sales</p>
          <BarChart points={data.trend.points} />
          <details className="mt-2 text-sm"><summary className="cursor-pointer font-semibold text-sky-700">Show as a table</summary>
            <div className="mt-2 max-h-72 overflow-auto rounded-xl border border-sky-100">
              <table className="w-full text-left text-sm"><thead className="sticky top-0 bg-sky-50 text-xs uppercase text-ink-soft"><tr><th className="p-2">Period</th><th className="p-2">Orders</th><th className="p-2">Order value</th><th className="p-2">Delivered sales</th></tr></thead>
                <tbody className="divide-y divide-sky-100">{data.trend.points.map((p) => <tr key={p.period}><td className="p-2">{p.period}</td><td className="p-2">{p.orders}</td><td className="p-2">{taka(p.gross)}</td><td className="p-2">{taka(p.deliveredSales)}</td></tr>)}</tbody></table>
            </div>
          </details>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <section>
              <h2 className="text-lg font-bold">Bestselling products</h2>
              <p className="text-xs text-ink-soft">Units in non-cancelled orders placed in this period</p>
              {data.bestsellers.length === 0 ? <p className="mt-2 text-sm text-ink-soft">No orders in this period.</p> : (
                <ol className="mt-2 divide-y divide-sky-100 rounded-2xl border border-sky-100 text-sm">
                  {data.bestsellers.map((b) => <li key={b.productId} className="flex justify-between gap-3 p-3"><span><b>{b.name.en}</b> <span className="text-ink-soft">{b.sku}</span></span><span>{b.quantity} units · {taka(b.revenue)}</span></li>)}
                </ol>
              )}
            </section>
            <section>
              <h2 className="text-lg font-bold">Low stock <span className="text-sm font-normal text-ink-soft">(≤ {data.lowStockThreshold})</span></h2>
              {data.lowStock.length === 0 ? <p className="mt-2 text-sm text-ink-soft">Nothing is running low.</p> : (
                <ul className="mt-2 divide-y divide-sky-100 rounded-2xl border border-sky-100 text-sm">
                  {data.lowStock.map((p) => <li key={p._id} className="flex items-center justify-between gap-3 p-3"><Link to={`/admin/products/${p._id}`} className="font-semibold hover:text-sky-700">{p.name.en} <span className="font-normal text-ink-soft">{p.sku}</span></Link><b className={p.stock === 0 ? 'text-red-700' : 'text-amber-700'}>{p.stock === 0 ? 'Out of stock' : `${p.stock} left`}</b></li>)}
                </ul>
              )}
            </section>
          </div>

          <section className="mt-8">
            <div className="flex items-center justify-between"><h2 className="text-lg font-bold">Recent orders</h2><Link to="/admin/orders" className="text-sm font-semibold text-sky-700 hover:underline">All orders →</Link></div>
            <div className="mt-2 overflow-x-auto rounded-2xl border border-sky-100">
              <table className="w-full min-w-[520px] text-left text-sm"><tbody className="divide-y divide-sky-100">
                {data.recentOrders.map((o) => <tr key={o.trackingId}><td className="p-3"><Link to={`/admin/orders/${o.trackingId}`} className="font-mono font-semibold text-sky-700 hover:underline">{o.trackingId}</Link></td><td className="p-3">{o.customerName}</td><td className="p-3">{dateTime(o.createdAt)}</td><td className="p-3">{taka(o.total)}</td><td className="p-3"><Badge status={o.status} /></td></tr>)}
                {data.recentOrders.length === 0 && <tr><td className="p-6 text-center text-ink-soft">No orders yet.</td></tr>}
              </tbody></table>
            </div>
          </section>
          <Explain>{RULES}</Explain>
        </div>
      )}
    </div>
  );
}
