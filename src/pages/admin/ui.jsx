import { useState } from 'react';

export const taka = (n) => `৳${new Intl.NumberFormat('en-US').format(n ?? 0)}`;
export const dateTime = (d) => (d ? new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Dhaka' }) : '—');
export const dateOnly = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { dateStyle: 'medium', timeZone: 'Asia/Dhaka' }) : '—');

export const STATUS_TONE = { pending: 'bg-amber-100 text-amber-800', confirmed: 'bg-sky-100 text-sky-800', processing: 'bg-sky-100 text-sky-800', shipped: 'bg-indigo-100 text-indigo-800', delivered: 'bg-emerald-100 text-emerald-800', cancelled: 'bg-red-100 text-red-800' };
export const Badge = ({ status, children }) => <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_TONE[status] ?? 'bg-sky-100 text-sky-800'}`}>{children ?? status}</span>;

export const Notice = ({ error, ok }) => (
  <>
    {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
    {ok && <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800" role="status">{ok}</p>}
  </>
);

export function Stat({ label, value, hint, tone = '' }) {
  return (
    <div className={`rounded-2xl border border-sky-100 p-4 ${tone}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{label}</p>
      <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-soft">{hint}</p>}
    </div>
  );
}

export const Pager = ({ data, onPage }) => (data && data.totalPages > 1 ? (
  <nav className="mt-4 flex items-center justify-center gap-3" aria-label="Pagination">
    <button className="btn-ghost" disabled={data.page <= 1} onClick={() => onPage(data.page - 1)}>Previous</button>
    <span className="text-sm text-ink-soft">Page {data.page} of {data.totalPages} · {data.total} total</span>
    <button className="btn-ghost" disabled={data.page >= data.totalPages} onClick={() => onPage(data.page + 1)}>Next</button>
  </nav>
) : null);

const PRESETS = [['today', 'Today'], ['last7', 'Last 7 days'], ['last30', 'Last 30 days'], ['this_month', 'This month'], ['prev_month', 'Previous month'], ['custom', 'Custom range'], ['all', 'All time']];
export const defaultRange = (preset = 'last30') => ({ preset, from: '', to: '' });
export const rangeQs = (r) => {
  const p = new URLSearchParams({ preset: r.preset });
  if (r.preset === 'custom') { p.set('from', r.from); p.set('to', r.to); }
  return p.toString();
};
export const rangeReady = (r) => r.preset !== 'custom' || (r.from && r.to && r.from <= r.to);

export function RangePicker({ value, onChange, presets = PRESETS }) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="text-sm font-semibold">Period
        <select className="input mt-1" value={value.preset} onChange={(e) => onChange({ ...value, preset: e.target.value })}>
          {presets.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      {value.preset === 'custom' && (
        <>
          <label className="text-sm font-semibold">From<input type="date" className="input mt-1" value={value.from} max={value.to || undefined} onChange={(e) => onChange({ ...value, from: e.target.value })} /></label>
          <label className="text-sm font-semibold">To<input type="date" className="input mt-1" value={value.to} min={value.from || undefined} onChange={(e) => onChange({ ...value, to: e.target.value })} /></label>
        </>
      )}
    </div>
  );
}

// Dependency-free SVG bars: light = all orders placed, solid = delivered sales. A table version sits next to it.
export function BarChart({ points }) {
  const max = Math.max(1, ...points.map((p) => p.gross));
  const w = Math.max(320, points.length * 22);
  const h = 160;
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h + 24}`} style={{ minWidth: w }} className="h-48 w-full" role="img" aria-label="Order value and delivered sales over time">
        {points.map((p, i) => {
          const x = i * (w / points.length) + 2;
          const bw = Math.max(4, w / points.length - 6);
          const hg = (p.gross / max) * h;
          const hd = (p.deliveredSales / max) * h;
          return (
            <g key={p.period}>
              <title>{`${p.period}: ${p.orders} orders, order value ${taka(p.gross)}, delivered ${taka(p.deliveredSales)}`}</title>
              <rect x={x} y={h - hg} width={bw} height={hg} rx="2" className="fill-sky-200" />
              <rect x={x} y={h - hd} width={bw} height={hd} rx="2" className="fill-sky-600" />
              {(points.length <= 12 || i % Math.ceil(points.length / 10) === 0) && <text x={x + bw / 2} y={h + 14} textAnchor="middle" fontSize="9" className="fill-ink-soft">{p.period.slice(points[0].period.length > 7 ? 5 : 2)}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function Explain({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-6 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm">
      <button className="font-semibold text-sky-700" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? '▾' : '▸'} How these numbers are calculated</button>
      {open && <div className="mt-2 space-y-1 text-ink-soft">{children}</div>}
    </div>
  );
}

export const RULES = (
  <ul className="list-disc space-y-1 pl-5">
    <li>Everything is grouped by <b>order date</b> (Bangladesh time). An order placed on the 31st and delivered on the 2nd counts in the month it was placed, so the figures always add up.</li>
    <li><b>Gross order value</b> = every order placed, including cancelled ones. <b>Gross = Delivered sales + Open orders + Cancelled.</b></li>
    <li><b>Delivered sales</b> = delivered orders, including the delivery charge the customer paid. Only these count as revenue.</li>
    <li><b>Open order value</b> = pending, confirmed, processing and shipped orders. It is <b>not</b> revenue yet: cash on delivery is only real money once the order is delivered.</li>
    <li><b>Cancelled value</b> = orders cancelled by the customer or an admin.</li>
    <li><b>Delivery charges</b> and <b>discounts</b> are shown for delivered orders. Discounts are already deducted from item prices, so they are not subtracted again.</li>
    <li><b>Estimated profit</b> = (price paid − cost price) × quantity for delivered items that have a cost price set. It excludes delivery charges and delivery costs, and shows “—” when no cost prices are set. The coverage % tells you how much delivered revenue it is based on. It is an estimate, not accounting profit.</li>
  </ul>
);
