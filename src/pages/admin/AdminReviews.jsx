import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdmin } from './AdminLayout.jsx';
import { errorText } from '../../services/api.js';
import { Notice, Pager, dateTime } from './ui.jsx';

const tone = { pending: 'bg-amber-100 text-amber-800', approved: 'bg-emerald-100 text-emerald-800', rejected: 'bg-red-100 text-red-800' };

export default function AdminReviews() {
  const { call } = useAdmin();
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const load = useCallback(async () => {
    const p = new URLSearchParams({ page: String(page), limit: '20' });
    if (status) p.set('status', status);
    const r = await call(`/reviews?${p}`);
    if (r.ok) { setData(r.data); setError(''); } else setError(errorText(r));
  }, [call, status, page]);
  useEffect(() => { load(); }, [load]);

  const act = async (fn, msg) => {
    const r = await fn();
    if (r.ok) { setOk(msg); setError(''); load(); } else { setOk(''); setError(errorText(r)); }
  };
  const set = (id, s) => act(() => call(`/reviews/${id}`, { method: 'PATCH', body: { status: s } }), `Review ${s}.`);
  const remove = (id) => window.confirm('Delete this review permanently?') && act(() => call(`/reviews/${id}`, { method: 'DELETE' }), 'Review deleted.');

  return (
    <div>
      <h1 className="text-2xl font-bold">Review moderation</h1>
      <p className="mt-1 text-sm text-ink-soft">Only approved reviews appear on the shop, and a product's rating is calculated from approved reviews only. All reviews here come from customers with a delivered order.</p>
      <div className="mt-4 flex gap-1" role="tablist" aria-label="Review status">
        {[['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['', 'All']].map(([v, l]) => (
          <button key={l} role="tab" aria-selected={status === v} onClick={() => { setStatus(v); setPage(1); }} className={`min-h-[44px] rounded-xl px-4 text-sm font-semibold ${status === v ? 'bg-sky-600 text-white' : 'text-sky-700 hover:bg-sky-50'}`}>{l}</button>
        ))}
      </div>
      <Notice error={error} ok={ok} />
      <ul className="mt-4 space-y-3">
        {!data && <li className="p-6 text-center text-ink-soft" role="status">Loading…</li>}
        {data?.items.length === 0 && <li className="rounded-2xl border border-dashed border-sky-200 p-8 text-center text-ink-soft">Nothing here.</li>}
        {data?.items.map((r) => (
          <li key={r.id} className="rounded-2xl border border-sky-100 p-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <b className="text-amber-500" aria-label={`${r.rating} out of 5`}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</b>
              {r.product && <Link to={`/product/${r.product.slug}`} className="font-semibold text-sky-700 hover:underline">{r.product.name.en}</Link>}
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone[r.status]}`}>{r.status}</span>
              <span className="text-ink-soft">by {r.customer?.name ?? 'deleted customer'} · {dateTime(r.createdAt)}</span>
            </div>
            <p className="mt-2 whitespace-pre-line text-sm">{r.comment || <i className="text-ink-soft">No comment</i>}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {r.status !== 'approved' && <button className="btn-primary !min-h-[40px]" onClick={() => set(r.id, 'approved')}>Approve</button>}
              {r.status !== 'rejected' && <button className="btn-ghost !min-h-[40px]" onClick={() => set(r.id, 'rejected')}>Reject</button>}
              {r.status !== 'pending' && <button className="btn-ghost !min-h-[40px]" onClick={() => set(r.id, 'pending')}>Back to pending</button>}
              <button className="btn-ghost !min-h-[40px] !text-red-700" onClick={() => remove(r.id)}>Delete</button>
            </div>
          </li>
        ))}
      </ul>
      <Pager data={data} onPage={setPage} />
    </div>
  );
}
