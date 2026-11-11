import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAdmin } from './AdminLayout.jsx';
import { errorText } from '../../services/api.js';
import { Badge, Notice, dateTime, taka } from './ui.jsx';

const NEXT_LABEL = { confirmed: 'Confirm order', processing: 'Start processing', shipped: 'Mark shipped / out for delivery', delivered: 'Mark delivered' };

export default function AdminOrderDetail() {
  const { trackingId } = useParams();
  const { call } = useAdmin();
  const [o, setO] = useState(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [cancelNote, setCancelNote] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    const r = await call(`/orders/${trackingId}`);
    if (r.ok) setO(r.data.order); else setError(errorText(r));
  }, [call, trackingId]);
  useEffect(() => { load(); }, [load]);

  const act = async (path, opts, msg) => {
    setBusy(true); setError(''); setOk('');
    const r = await call(path, opts);
    setBusy(false);
    if (r.ok) { setO(r.data.order); setOk(msg); return true; }
    setError(errorText(r));
    if (r.status === 409) load(); // someone else changed it: show the current state
    return false;
  };
  const setStatus = (status, text) => act(`/orders/${trackingId}/status`, { method: 'PATCH', body: { status, note: text || undefined } }, `Order is now ${status}.`);

  if (!o) return <div><Notice error={error} />{!error && <p className="p-8 text-center text-ink-soft" role="status">Loading…</p>}<Link to="/admin/orders" className="text-sm font-semibold text-sky-700">← Orders</Link></div>;
  const next = o.canTransitionTo.filter((s) => s !== 'cancelled');
  const canCancel = o.canTransitionTo.includes('cancelled');

  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link to="/admin/orders" className="text-sm font-semibold text-sky-700 hover:underline">← Orders</Link>
        <Link to={`/admin/orders/${o.trackingId}/print`} className="btn-ghost">Print invoice / packing slip</Link>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div><h1 className="select-all font-mono text-xl font-bold">{o.trackingId}</h1><p className="text-sm text-ink-soft">Placed {dateTime(o.createdAt)}{o.deliveredAt && ` · Delivered ${dateTime(o.deliveredAt)}`}</p></div>
        <Badge status={o.status} />
      </div>
      <Notice error={error} ok={ok} />

      <div className="mt-4 flex flex-wrap items-start gap-2 rounded-2xl border border-sky-100 p-4">
        <p className="w-full text-sm font-semibold">Next step</p>
        {next.map((s) => <button key={s} className="btn-primary" disabled={busy} onClick={() => setStatus(s)}>{NEXT_LABEL[s]}</button>)}
        {next.length === 0 && !canCancel && <p className="text-sm text-ink-soft">This order is {o.status}; no further status changes are possible.</p>}
        {canCancel && !cancelling && <button className="btn-ghost !text-red-700" disabled={busy} onClick={() => setCancelling(true)}>Cancel order</button>}
        {cancelling && (
          <div className="w-full rounded-xl bg-red-50 p-3" role="alertdialog" aria-label="Cancel order">
            <p className="text-sm font-semibold">Cancel this order? The stock is returned to the shelf.</p>
            <input className="input mt-2" placeholder="Reason (optional, internal)" maxLength={300} value={cancelNote} onChange={(e) => setCancelNote(e.target.value)} />
            <div className="mt-2 flex gap-2">
              <button className="btn-primary !bg-red-600" disabled={busy} onClick={async () => { if (await setStatus('cancelled', cancelNote)) setCancelling(false); }}>Yes, cancel</button>
              <button className="btn-ghost" onClick={() => setCancelling(false)}>Keep order</button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-sky-100 p-4 text-sm">
          <h2 className="font-bold">Delivery details (entered by the customer)</h2>
          <p className="mt-2 font-semibold">{o.customer.name} · {o.customer.phone}</p>
          <p className="text-ink-soft">{o.customer.address}{o.customer.area ? `, ${o.customer.area}` : ''}, {o.customer.district}</p>
          <p className="mt-2">{o.deliveryZone === 'inside_dhaka' ? 'Inside Dhaka' : 'Outside Dhaka'} delivery</p>
          <p className="mt-2 text-xs text-ink-soft">Account: <Link className="text-sky-700 hover:underline" to={`/admin/customers/${o.account.id}`}>{o.account.name ?? 'customer'}</Link>{o.account.phone && ` · ${o.account.phone}`}</p>
          {o.attribution && <p className="text-xs text-ink-soft">Campaign: {Object.values(o.attribution).filter(Boolean).join(' / ')}</p>}
        </section>
        <section className="rounded-2xl border border-sky-100 p-4 text-sm">
          <h2 className="font-bold">Payment: Cash on delivery</h2>
          <p className="mt-2">Amount to collect: <b className="text-lg">{taka(o.total)}</b></p>
          <p className="mt-1">Status: {o.paymentStatus === 'collected' ? <b className="text-emerald-700">Collected {dateTime(o.paymentCollectedAt)}</b> : <b className="text-amber-700">Not collected</b>}</p>
          <div className="mt-3">
            {o.paymentStatus === 'unpaid' && o.status === 'delivered' && <button className="btn-primary" disabled={busy} onClick={() => act(`/orders/${trackingId}/payment`, { method: 'POST', body: { paymentStatus: 'collected' } }, 'Cash marked as collected.')}>Mark cash collected</button>}
            {o.paymentStatus === 'unpaid' && o.status !== 'delivered' && <p className="text-xs text-ink-soft">Cash can be marked collected once the order is delivered.</p>}
            {o.paymentStatus === 'collected' && <button className="btn-ghost" disabled={busy} onClick={() => window.confirm('Undo “collected”?') && act(`/orders/${trackingId}/payment`, { method: 'POST', body: { paymentStatus: 'unpaid' } }, 'Marked as not collected.')}>Undo (mark not collected)</button>}
          </div>
        </section>
      </div>

      <section className="mt-4 rounded-2xl border border-sky-100 p-4">
        <h2 className="font-bold">Items</h2>
        <div className="mt-2 overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm">
          <thead className="text-xs uppercase text-ink-soft"><tr><th className="py-1">Product</th><th>Price paid</th><th>Qty</th><th>Line total</th><th>Cost</th></tr></thead>
          <tbody className="divide-y divide-sky-100">{o.items.map((i) => <tr key={i.productId}><td className="py-2">{i.name.en}<div className="text-xs text-ink-soft">{i.sku}</div></td><td>{taka(i.unitPrice)}{i.listPrice > i.unitPrice && <s className="ml-1 text-xs text-ink-soft">{taka(i.listPrice)}</s>}</td><td>{i.quantity}</td><td className="font-semibold">{taka(i.lineTotal)}</td><td className="text-ink-soft">{i.costPrice != null ? taka(i.costPrice) : '—'}</td></tr>)}</tbody>
        </table></div>
        <dl className="ml-auto mt-3 max-w-xs space-y-1 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{taka(o.subtotal)}</dd></div>
          {o.discountTotal > 0 && <div className="flex justify-between text-emerald-700"><dt>Discount (included above)</dt><dd>{taka(o.discountTotal)}</dd></div>}
          <div className="flex justify-between"><dt>Delivery charge</dt><dd>{taka(o.deliveryFee)}</dd></div>
          <div className="flex justify-between border-t border-sky-100 pt-1 text-base font-bold"><dt>Total</dt><dd>{taka(o.total)}</dd></div>
        </dl>
      </section>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-sky-100 p-4 text-sm">
          <h2 className="font-bold">Status history</h2>
          <ol className="mt-2 space-y-2">{o.statusHistory.map((h, i) => <li key={i}><Badge status={h.status} /> <span className="text-ink-soft">{dateTime(h.at)}{h.by && ` · ${h.by}`}</span>{h.note && <p className="text-xs text-ink-soft">{h.note}</p>}</li>)}</ol>
        </section>
        <section className="rounded-2xl border border-sky-100 p-4 text-sm">
          <h2 className="font-bold">Internal notes <span className="text-xs font-normal text-ink-soft">(never shown to the customer)</span></h2>
          <ul className="mt-2 space-y-2">{o.internalNotes.map((n, i) => <li key={i} className="rounded-lg bg-sky-50 p-2">{n.text}<div className="text-xs text-ink-soft">{n.by ?? 'admin'} · {dateTime(n.at)}</div></li>)}{o.internalNotes.length === 0 && <li className="text-ink-soft">No notes yet.</li>}</ul>
          <form className="mt-3 flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (note.trim() && (await act(`/orders/${trackingId}/notes`, { method: 'POST', body: { text: note.trim() } }, 'Note added.'))) setNote(''); }}>
            <input className="input" aria-label="New note" maxLength={500} placeholder="Add a note…" value={note} onChange={(e) => setNote(e.target.value)} />
            <button className="btn-primary" disabled={busy || !note.trim()}>Add</button>
          </form>
        </section>
      </div>
    </div>
  );
}
