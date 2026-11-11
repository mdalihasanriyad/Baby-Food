import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAdmin } from './AdminLayout.jsx';
import { api } from '../../services/api.js';
import { dateTime, taka } from './ui.jsx';

// Clean invoice + packing summary. Browser print / "Save as PDF" is the export. The admin header is hidden in print.
export default function AdminOrderPrint() {
  const { trackingId } = useParams();
  const { call } = useAdmin();
  const [o, setO] = useState(null);
  const [shop, setShop] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    call(`/orders/${trackingId}`).then((r) => (r.ok ? setO(r.data.order) : setError('Order not found.')));
    api('/settings/public').then((r) => r.ok && setShop(r.data));
  }, [call, trackingId]);

  if (error) return <p className="p-8 text-red-700" role="alert">{error}</p>;
  if (!o) return <p className="p-8 text-center text-ink-soft" role="status">Loading…</p>;
  const c = shop?.contact ?? {};
  return (
    <div className="mx-auto max-w-3xl bg-white p-2 print:max-w-none print:p-0">
      <div className="mb-4 flex justify-between gap-2 print:hidden">
        <Link to={`/admin/orders/${o.trackingId}`} className="text-sm font-semibold text-sky-700 hover:underline">← Back to order</Link>
        <button className="btn-primary" onClick={() => window.print()}>Print / save as PDF</button>
      </div>
      <header className="flex justify-between gap-4 border-b-2 border-ink pb-3">
        <div><h1 className="text-xl font-bold">Baby Food Gallery</h1><p className="text-xs">babyfoodgallery.com</p>{c.address && <p className="text-xs">{c.address}</p>}{(c.phone || c.email) && <p className="text-xs">{[c.phone, c.email].filter(Boolean).join(' · ')}</p>}</div>
        <div className="text-right text-sm"><p className="text-lg font-bold">INVOICE / PACKING SLIP</p><p className="font-mono">{o.trackingId}</p><p>{dateTime(o.createdAt)}</p></div>
      </header>
      <section className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div><p className="font-bold">Deliver to</p><p>{o.customer.name}</p><p>{o.customer.phone}</p><p>{o.customer.address}{o.customer.area ? `, ${o.customer.area}` : ''}</p><p>{o.customer.district} ({o.deliveryZone === 'inside_dhaka' ? 'Inside Dhaka' : 'Outside Dhaka'})</p></div>
        <div className="text-right"><p className="font-bold">Payment: Cash on delivery</p><p className="text-xl font-bold">Collect {taka(o.total)}</p><p>Status: {o.status}</p></div>
      </section>
      <table className="mt-4 w-full text-left text-sm">
        <thead className="border-b border-ink"><tr><th className="py-1 pr-2 print:w-8">Packed</th><th>Item</th><th>SKU</th><th className="text-right">Price</th><th className="text-right">Qty</th><th className="text-right">Total</th></tr></thead>
        <tbody className="divide-y divide-gray-300">{o.items.map((i) => <tr key={i.productId}><td className="py-2"><span className="inline-block h-4 w-4 border border-ink" aria-hidden="true" /></td><td>{i.name.en}</td><td className="text-xs">{i.sku}</td><td className="text-right">{taka(i.unitPrice)}</td><td className="text-right">{i.quantity}</td><td className="text-right">{taka(i.lineTotal)}</td></tr>)}</tbody>
      </table>
      <dl className="ml-auto mt-3 max-w-xs space-y-1 text-sm">
        <div className="flex justify-between"><dt>Subtotal</dt><dd>{taka(o.subtotal)}</dd></div>
        {o.discountTotal > 0 && <div className="flex justify-between"><dt>You saved (included)</dt><dd>{taka(o.discountTotal)}</dd></div>}
        <div className="flex justify-between"><dt>Delivery charge</dt><dd>{taka(o.deliveryFee)}</dd></div>
        <div className="flex justify-between border-t border-ink pt-1 text-base font-bold"><dt>Total</dt><dd>{taka(o.total)}</dd></div>
      </dl>
      <p className="mt-8 text-center text-xs">Thank you for shopping with Baby Food Gallery.</p>
    </div>
  );
}
