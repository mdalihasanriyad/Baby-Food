import Order from '../models/Order.js';
import Product from '../models/Product.js';
import StoreSettings from '../models/StoreSettings.js';
import { AppError } from '../utils/errors.js';
import { CUSTOMER_CANCELLABLE, ORDER_TRANSITIONS } from '../models/constants.js';
import { withOptionalTransaction } from '../utils/tx.js';
import { DISTRICT_BY_VALUE } from '../constants/districts.js';
import { getProvider } from '../payments/index.js';
import { PUBLIC_FILTER } from './catalog.js';
import { mergeLines } from './cart.js';

export const feeFor = (settings, zone) => (zone === 'inside_dhaka' ? settings.delivery.insideDhaka : settings.delivery.outsideDhaka);

const changed = (items) => new AppError(409, 'Some items changed. Please review your cart.', 'STOCK_CHANGED', { items });

// What a customer may see. Never includes internal notes, user ids, idempotency keys or cost prices.
export const orderView = (o) => ({
  trackingId: o.trackingId, status: o.status, createdAt: o.createdAt, canCancel: CUSTOMER_CANCELLABLE.includes(o.status),
  paymentMethod: o.paymentMethod, paymentStatus: o.paymentStatus, deliveryZone: o.deliveryZone,
  customer: { name: o.customer.name, phone: o.customer.phone, address: o.customer.address, district: o.customer.district, area: o.customer.area ?? '' },
  items: o.items.map((i) => ({ productId: String(i.product), name: i.name, image: i.image ?? null, listPrice: i.listPrice, unitPrice: i.unitPrice, quantity: i.quantity, lineTotal: i.lineTotal })),
  subtotal: o.subtotal, discountTotal: o.discountTotal, deliveryFee: o.deliveryFee, total: o.total,
  statusHistory: o.statusHistory.map((h) => ({ status: h.status, at: h.at })),
});

/**
 * Places a COD order. The client sends ONLY ids, quantities, address, zone and an idempotency key.
 * Prices, discounts, delivery fee and totals are all computed here from the database.
 * Stock policy: deducted when the order is created; restored if the order is cancelled (Phase 7).
 */
export async function createOrder(user, input) {
  const provider = getProvider(input.paymentMethod);
  if (!provider) throw new AppError(400, 'Unsupported payment method', 'INVALID_PAYMENT');

  // Inside Dhaka <=> the Dhaka district. Stops anyone from paying the cheaper fee for a far-away address.
  const isDhaka = input.customer.district === 'dhaka';
  if ((input.deliveryZone === 'inside_dhaka') !== isDhaka) {
    throw new AppError(400, 'Delivery area does not match the district', 'ZONE_MISMATCH', [{ field: 'deliveryZone', message: 'zone_mismatch' }]);
  }

  // Duplicate-submission guard: the same key returns the order that already exists.
  const existing = await Order.findOne({ user: user._id, idempotencyKey: input.idempotencyKey });
  if (existing) return { order: existing, duplicate: true };

  const settings = await StoreSettings.getSingleton();
  const deliveryFee = feeFor(settings, input.deliveryZone);
  const lines = mergeLines(input.items);
  const { paymentStatus } = await provider.initiate({ user });

  try {
    const order = await withOptionalTransaction(async (session) => {
      const deducted = [];
      try {
        const products = await Product.find({ _id: { $in: lines.map((l) => l.productId) }, ...PUBLIC_FILTER }).select('+costPrice').session(session);
        const byId = new Map(products.map((p) => [String(p._id), p]));

        const problems = [];
        for (const l of lines) {
          const p = byId.get(l.productId);
          if (!p) problems.push({ productId: l.productId, reason: 'unavailable' });
          else if (p.stock < l.quantity) problems.push({ productId: l.productId, name: p.name, reason: p.stock <= 0 ? 'out_of_stock' : 'insufficient', available: p.stock });
        }
        if (problems.length) throw changed(problems);

        // The real overselling guard: one atomic conditional decrement per line.
        for (const l of lines) {
          const r = await Product.updateOne({ _id: l.productId, ...PUBLIC_FILTER, stock: { $gte: l.quantity } }, { $inc: { stock: -l.quantity } }, session ? { session } : {});
          if (r.modifiedCount !== 1) {
            const p = byId.get(l.productId);
            throw changed([{ productId: l.productId, name: p.name, reason: 'insufficient' }]);
          }
          deducted.push(l);
        }

        const items = lines.map((l) => {
          const p = byId.get(l.productId);
          return {
            product: p._id, sku: p.sku, name: { bn: p.name.bn, en: p.name.en }, image: p.images?.[0]?.url,
            listPrice: p.price, unitPrice: p.effectivePrice, quantity: l.quantity, lineTotal: p.effectivePrice * l.quantity,
            ...(p.costPrice != null ? { costPrice: p.costPrice } : {}),
          };
        });
        const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
        const discountTotal = items.reduce((s, i) => s + (i.listPrice - i.unitPrice) * i.quantity, 0);
        const c = input.customer;
        const doc = new Order({
          user: user._id, idempotencyKey: input.idempotencyKey, items,
          customer: { name: c.name, phone: c.phone, address: c.address, district: DISTRICT_BY_VALUE.get(c.district).en, ...(c.area ? { area: c.area } : {}) },
          deliveryZone: input.deliveryZone, subtotal, discountTotal, deliveryFee, total: subtotal + deliveryFee,
          paymentMethod: input.paymentMethod, paymentStatus, status: 'pending',
          statusHistory: [{ status: 'pending', note: 'Order placed', by: user._id }],
          ...(input.attribution ? { attribution: input.attribution } : {}),
        });
        await doc.save(session ? { session } : {});
        return doc;
      } catch (err) {
        // Without a transaction there is no automatic rollback, so give the stock back by hand.
        if (!session) for (const d of deducted) await Product.updateOne({ _id: d.productId }, { $inc: { stock: d.quantity } });
        throw err;
      }
    });
    return { order, duplicate: false };
  } catch (err) {
    if (err?.code === 11000 && err.keyPattern?.idempotencyKey) { // two identical requests raced
      const again = await Order.findOne({ user: user._id, idempotencyKey: input.idempotencyKey });
      if (again) return { order: again, duplicate: true };
    }
    throw err;
  }
}

// Compact row for the order-history list.
export const orderSummary = (o) => ({
  trackingId: o.trackingId, status: o.status, createdAt: o.createdAt, total: o.total,
  canCancel: CUSTOMER_CANCELLABLE.includes(o.status),
  itemCount: o.items.reduce((n, i) => n + i.quantity, 0),
  items: o.items.slice(0, 3).map((i) => ({ name: i.name, image: i.image ?? null, quantity: i.quantity })),
});

/**
 * Cancels an order and puts its stock back. Safe against double-cancel and against racing with a status
 * change: the status flip is ONE conditional update, so only a single caller can win.
 * `filter` selects the order (e.g. { trackingId, user }); `allowedFrom` lists the statuses it may be cancelled from.
 * Returns the cancelled order, or null if it was not in a cancellable state. Reused by admin cancellation (Phase 8).
 */
export async function cancelOrder({ filter, allowedFrom, actorId, note }) {
  return withOptionalTransaction(async (session) => {
    const opt = session ? { session } : {};
    const now = new Date();
    const order = await Order.findOneAndUpdate(
      { ...filter, status: { $in: allowedFrom }, stockDeducted: true },
      { $set: { status: 'cancelled', cancelledAt: now, stockDeducted: false }, $push: { statusHistory: { status: 'cancelled', at: now, note, by: actorId } } },
      { new: true, ...opt }
    );
    if (!order) return null;
    for (const i of order.items) {
      try {
        await Product.updateOne({ _id: i.product }, { $inc: { stock: i.quantity } }, opt);
      } catch (err) {
        if (session) throw err; // transaction: everything rolls back
        console.error(`stock restore failed for product ${i.product} (order ${order.trackingId})`); // no transaction: stock stays under-counted, never over-sold
      }
    }
    return order;
  });
}

const ADMIN_CANCELLABLE = ['pending', 'confirmed', 'processing', 'shipped'];

/**
 * Admin status change. Only transitions listed in ORDER_TRANSITIONS are allowed (next step or cancel), and every
 * change is a compare-and-set on the current status, so two admins (or an admin and a customer) cannot both win.
 *  - cancelled: stock goes back (same code path as customer cancellation).
 *  - delivered: stamps deliveredAt and adds the quantities to each product's soldCount (feeds "popular" sorting).
 */
export async function changeOrderStatus({ trackingId, to, actorId, note }) {
  const current = await Order.findOne({ trackingId }).select('status');
  if (!current) throw new AppError(404, 'Order not found', 'NOT_FOUND');
  const allowed = ORDER_TRANSITIONS[current.status];
  if (!allowed.includes(to)) {
    throw new AppError(409, `Cannot change an order from "${current.status}" to "${to}"`, 'INVALID_TRANSITION', { from: current.status, to, allowed });
  }
  const stale = () => new AppError(409, 'The order was changed by someone else. Reload and try again.', 'STATUS_CHANGED');

  if (to === 'cancelled') {
    const done = await cancelOrder({ filter: { trackingId }, allowedFrom: ADMIN_CANCELLABLE, actorId, note: note ? `Cancelled by admin: ${note}` : 'Cancelled by admin' });
    if (!done) throw stale();
    return done;
  }
  const now = new Date();
  const entry = { status: to, at: now, by: actorId, ...(note ? { note } : {}) };
  return withOptionalTransaction(async (session) => {
    const opt = session ? { session } : {};
    const order = await Order.findOneAndUpdate(
      { trackingId, status: current.status },
      { $set: { status: to, ...(to === 'delivered' ? { deliveredAt: now } : {}) }, $push: { statusHistory: entry } },
      { new: true, ...opt }
    );
    if (!order) throw stale();
    if (to === 'delivered') {
      await Product.bulkWrite(order.items.map((i) => ({ updateOne: { filter: { _id: i.product }, update: { $inc: { soldCount: i.quantity } } } })), opt);
    }
    return order;
  });
}

// Everything an admin may see about an order (still never the idempotency key).
export const adminOrderView = (o) => ({
  trackingId: o.trackingId, status: o.status, createdAt: o.createdAt, deliveredAt: o.deliveredAt ?? null, cancelledAt: o.cancelledAt ?? null,
  paymentMethod: o.paymentMethod, paymentStatus: o.paymentStatus, paymentCollectedAt: o.paymentCollectedAt ?? null, deliveryZone: o.deliveryZone,
  customer: o.customer, attribution: o.attribution ?? null,
  account: o.user?.name ? { id: String(o.user._id), name: o.user.name, phone: o.user.phone, email: o.user.email ?? null } : { id: String(o.user?._id ?? o.user) },
  items: o.items.map((i) => ({ productId: String(i.product), sku: i.sku, name: i.name, image: i.image ?? null, listPrice: i.listPrice, unitPrice: i.unitPrice, costPrice: i.costPrice ?? null, quantity: i.quantity, lineTotal: i.lineTotal })),
  subtotal: o.subtotal, discountTotal: o.discountTotal, deliveryFee: o.deliveryFee, total: o.total,
  statusHistory: o.statusHistory.map((h) => ({ status: h.status, at: h.at, note: h.note ?? '', by: h.by?.name ?? null })),
  internalNotes: o.internalNotes.map((n) => ({ text: n.text, at: n.at, by: n.by?.name ?? null })),
  canTransitionTo: ORDER_TRANSITIONS[o.status],
});
