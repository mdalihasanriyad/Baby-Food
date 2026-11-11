import { useEffect, useState } from 'react';
import { useAdmin } from './AdminLayout.jsx';
import { errorText } from '../../services/api.js';
import { Explain, Notice, Pager, RULES, RangePicker, Stat, defaultRange, rangeQs, rangeReady, taka } from './ui.jsx';

export default function AdminReports() {
  const { call } = useAdmin();
  const [range, setRange] = useState(defaultRange('all'));
  const [groupBy, setGroupBy] = useState('month');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!rangeReady(range)) return undefined;
    let alive = true;
    setLoading(true);
    call(`/reports/sales?${rangeQs(range)}&groupBy=${groupBy}&page=${page}&limit=24`).then((r) => {
      if (!alive) return;
      setLoading(false);
      if (r.ok) { setData(r.data); setError(''); } else setError(errorText(r));
    });
    return () => { alive = false; };
  }, [call, range, groupBy, page]);

  const t = data?.totals;
  const label = { day: 'Day', month: 'Month', year: 'Year' }[groupBy];
  return (
    <div>
      <h1 className="text-2xl font-bold">Sales reports</h1>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-sm font-semibold">Group by
          <select className="input mt-1" value={groupBy} onChange={(e) => { setGroupBy(e.target.value); setPage(1); }}>
            <option value="day">Day</option><option value="month">Month (month by month)</option><option value="year">Year (year by year)</option>
          </select>
        </label>
        <RangePicker value={range} onChange={(r) => { setRange(r); setPage(1); }} />
      </div>
      <Notice error={error} />
      {!data && loading && <p className="mt-8 text-center text-ink-soft" role="status">Loading…</p>}

      {data && (
        <div className={loading ? 'opacity-60 transition-opacity' : ''}>
          <p className="mt-3 text-sm text-ink-soft">{data.range.from ?? 'Beginning'} → {data.range.to} (Bangladesh time) · totals for the whole period</p>
          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Delivered sales" value={taka(t.money.deliveredSales)} tone="bg-emerald-50" hint={`${t.orders.delivered} orders`} />
            <Stat label="Open orders (not revenue)" value={taka(t.money.openOrderValue)} tone="bg-amber-50" hint={`${t.orders.open} orders`} />
            <Stat label="Cancelled" value={taka(t.money.cancelledValue)} tone="bg-red-50" hint={`${t.orders.cancelled} orders`} />
            <Stat label="Gross order value" value={taka(t.money.grossOrderValue)} hint={`${t.orders.total} orders`} />
          </div>

          <div className="mt-6 overflow-x-auto rounded-2xl border border-sky-100">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-sky-50 text-xs uppercase text-ink-soft">
                <tr><th className="p-3">{label}</th><th className="p-3">Orders</th><th className="p-3">Gross order value</th><th className="p-3">Delivered</th><th className="p-3">Delivered sales</th><th className="p-3">Delivery charges</th><th className="p-3">Discounts</th><th className="p-3">Open value</th><th className="p-3">Cancelled value</th><th className="p-3">Est. profit</th></tr>
              </thead>
              <tbody className="divide-y divide-sky-100">
                {data.rows.length === 0 && <tr><td className="p-6 text-center text-ink-soft" colSpan="10">No orders in this period.</td></tr>}
                {data.rows.map((r) => (
                  <tr key={r.period}>
                    <td className="p-3 font-semibold">{r.period}</td><td className="p-3">{r.orders}</td><td className="p-3">{taka(r.gross)}</td>
                    <td className="p-3">{r.deliveredOrders}</td><td className="p-3 font-semibold text-emerald-700">{taka(r.deliveredSales)}</td>
                    <td className="p-3">{taka(r.deliveryCharges)}</td><td className="p-3">{taka(r.discounts)}</td>
                    <td className="p-3 text-amber-700">{taka(r.openValue)}</td><td className="p-3 text-red-700">{taka(r.cancelledValue)}</td>
                    <td className="p-3">{r.estimatedProfit === null ? '—' : <>{taka(r.estimatedProfit)}<span className="block text-xs text-ink-soft">{r.profitCoveragePercent}% covered</span></>}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-sky-50 font-semibold"><tr><td className="p-3">All (period)</td><td className="p-3">{t.orders.total}</td><td className="p-3">{taka(t.money.grossOrderValue)}</td><td className="p-3">{t.orders.delivered}</td><td className="p-3">{taka(t.money.deliveredSales)}</td><td className="p-3">{taka(t.money.deliveryCharges)}</td><td className="p-3">{taka(t.money.discountsGiven)}</td><td className="p-3">{taka(t.money.openOrderValue)}</td><td className="p-3">{taka(t.money.cancelledValue)}</td><td className="p-3">{t.profit.estimatedProfit === null ? '—' : taka(t.profit.estimatedProfit)}</td></tr></tfoot>
            </table>
          </div>
          <Pager data={data} onPage={setPage} />
          <Explain>{RULES}</Explain>
        </div>
      )}
    </div>
  );
}
