import Product from '../models/Product.js';
import { PUBLIC_FILTER } from './catalog.js';

export const MAX_LINE_QTY = 50;

// Merge duplicate product lines and cap quantities.
export function mergeLines(items) {
  const m = new Map();
  for (const { productId, quantity } of items) m.set(String(productId), Math.min((m.get(String(productId)) ?? 0) + quantity, MAX_LINE_QTY));
  return [...m].map(([productId, quantity]) => ({ productId, quantity }));
}

// Prices a cart from the DATABASE. The client only supplies product ids and quantities.
export async function quoteCart(items, deliveryFee = null) {
  const lines = mergeLines(items);
  const products = await Product.find({ _id: { $in: lines.map((l) => l.productId) }, ...PUBLIC_FILTER })
    .select('slug name price salePrice effectivePrice stock images').lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));

  let subtotal = 0;
  let discountTotal = 0;
  const out = lines.map((l) => {
    const p = byId.get(l.productId);
    if (!p) return { productId: l.productId, status: 'unavailable', quantity: l.quantity, allowedQuantity: 0, lineTotal: 0 };
    const allowed = Math.min(l.quantity, p.stock);
    const status = p.stock <= 0 ? 'out_of_stock' : allowed < l.quantity ? 'adjusted' : 'ok';
    const lineTotal = p.effectivePrice * allowed;
    subtotal += lineTotal;
    discountTotal += (p.price - p.effectivePrice) * allowed;
    return {
      productId: l.productId, slug: p.slug, name: p.name, image: p.images?.[0]?.url ?? null,
      listPrice: p.price, unitPrice: p.effectivePrice, stock: p.stock,
      quantity: l.quantity, allowedQuantity: allowed, status, lineTotal,
    };
  });
  return {
    lines: out, subtotal, discountTotal, deliveryFee,
    total: subtotal + (deliveryFee ?? 0),
    blocked: out.some((l) => l.status === 'unavailable' || l.status === 'out_of_stock'),
  };
}
