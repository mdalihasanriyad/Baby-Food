import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './helpers/setup.js';

const ctx = await setup();
if (!ctx) process.exit(0);
const { call, adminCookie, customerCookie, tag, cleanup } = ctx;
const { default: Product } = await import('../api/_lib/models/Product.js');
const { default: Category } = await import('../api/_lib/models/Category.js');
const { default: Order } = await import('../api/_lib/models/Order.js');
const { default: Review } = await import('../api/_lib/models/Review.js');
const { default: User } = await import('../api/_lib/models/User.js');
const { default: StoreSettings } = await import('../api/_lib/models/StoreSettings.js');
const { dhakaMonthString } = await import('../api/_lib/utils/dhaka.js');

let cat; let prod; let n = 0; let original;
const A = (path, opts = {}) => call(`/api/admin${path}`, { ...opts, cookie: adminCookie });
const json = async (r) => r.json();
const place = async (qty = 1) => {
  const r = await call('/api/orders', { method: 'POST', cookie: customerCookie, body: {
    items: [{ productId: String(prod._id), quantity: qty }], deliveryZone: 'inside_dhaka', paymentMethod: 'cod', idempotencyKey: `t8-${tag}-${++n}-abcdefgh`,
    customer: { name: 'Buyer', phone: '01711111111', district: 'dhaka', address: 'House 1, Road 2' } } });
  assert.equal(r.status, 201);
  return (await r.json()).order;
};
const status = (id, to, note) => A(`/orders/${id}/status`, { method: 'PATCH', body: { status: to, note } });
const walk = async (id, steps) => { for (const s of steps) assert.equal((await status(id, s)).status, 200, s); };
const dash = async () => (await json(await A('/dashboard?preset=today'))); // diffs below: other test data may exist

before(async () => {
  cat = await Category.create({ name: { bn: 'অ', en: `ZZ Adm ${tag}` }, slug: `zz-adm-${tag}` });
  prod = await Product.create({ slug: `zz-adm-${tag}`, sku: `ZZ-ADM-${tag}`, name: { bn: 'অ্যাডমিন', en: 'ZZ Admin' }, category: cat._id, price: 500, costPrice: 300, stock: 50, isPublished: true });
  original = (await StoreSettings.getSingleton()).toObject().delivery;
});
after(async () => {
  await StoreSettings.updateOne({ key: 'main' }, { $set: { 'delivery.insideDhaka': original.insideDhaka, 'delivery.outsideDhaka': original.outsideDhaka } });
  await Review.deleteMany({ product: prod?._id });
  await Order.deleteMany({ idempotencyKey: new RegExp(`^t8-${tag}`) });
  await Product.deleteMany({ sku: `ZZ-ADM-${tag}` });
  await Category.deleteMany({ slug: `zz-adm-${tag}` });
  await cleanup();
});

test('customers and anonymous users cannot reach any admin back-office route', async () => {
  for (const path of ['/orders', '/orders/BFG-0000000000000000', '/dashboard', '/reports/sales', '/customers', '/reviews', '/settings']) {
    assert.equal((await call(`/api/admin${path}`)).status, 401, path);
    assert.equal((await call(`/api/admin${path}`, { cookie: customerCookie })).status, 401, path);
  }
  assert.equal((await call('/api/admin/settings', { method: 'PATCH', cookie: customerCookie, body: { delivery: { insideDhaka: 1 } } })).status, 401);
});

test('status workflow: only valid transitions, delivered stamps soldCount, delivered is final', async () => {
  const o = await place(2);
  assert.equal((await status(o.trackingId, 'shipped')).status, 409); // cannot skip steps
  assert.equal((await status(o.trackingId, 'delivered')).status, 409);
  await walk(o.trackingId, ['confirmed', 'processing', 'shipped', 'delivered']);
  const d = await json(await A(`/orders/${o.trackingId}`));
  assert.equal(d.order.status, 'delivered');
  assert.ok(d.order.deliveredAt);
  assert.deepEqual(d.order.statusHistory.map((h) => h.status), ['pending', 'confirmed', 'processing', 'shipped', 'delivered']);
  assert.equal(d.order.items[0].costPrice, 300); // admins see cost; customers never do
  assert.equal((await Product.findById(prod._id).select('soldCount')).soldCount >= 2, true);
  assert.equal((await status(o.trackingId, 'cancelled')).status, 409); // delivered cannot be cancelled
  const mine = await json(await call(`/api/orders/${o.trackingId}`, { cookie: customerCookie }));
  assert.equal(mine.order.items[0].costPrice, undefined);
});

test('two admins confirming at once: exactly one wins', async () => {
  const o = await place(1);
  const rs = await Promise.all([status(o.trackingId, 'confirmed'), status(o.trackingId, 'confirmed')]);
  assert.deepEqual(rs.map((r) => r.status).sort(), [200, 409]);
});

test('admin cancel restores stock; customers cannot cancel after processing', async () => {
  const before1 = (await Product.findById(prod._id)).stock;
  const o = await place(3);
  await walk(o.trackingId, ['confirmed', 'processing']);
  const mine = await call(`/api/orders/${o.trackingId}/cancel`, { method: 'POST', cookie: customerCookie });
  assert.equal(mine.status, 409);
  assert.equal((await status(o.trackingId, 'cancelled', 'Customer phoned')).status, 200);
  assert.equal((await Product.findById(prod._id)).stock, before1);
  const d = await json(await A(`/orders/${o.trackingId}`));
  assert.match(d.order.statusHistory.at(-1).note, /Cancelled by admin: Customer phoned/);
});

test('COD collection: only after delivery, only once, can be undone, leaves a trail', async () => {
  const o = await place(1);
  const pay = (s) => A(`/orders/${o.trackingId}/payment`, { method: 'POST', body: { paymentStatus: s } });
  assert.equal((await pay('collected')).status, 409); // not delivered yet
  await walk(o.trackingId, ['confirmed', 'processing', 'shipped', 'delivered']);
  assert.equal((await pay('collected')).status, 200);
  assert.equal((await pay('collected')).status, 409);
  const d = await json(await A(`/orders/${o.trackingId}`));
  assert.equal(d.order.paymentStatus, 'collected');
  assert.ok(d.order.paymentCollectedAt);
  assert.ok(d.order.internalNotes.some((x) => /collected/.test(x.text)));
  assert.equal((await pay('unpaid')).status, 200);
  assert.equal((await pay('unpaid')).status, 409);
});

test('internal notes are admin-only', async () => {
  const o = await place(1);
  assert.equal((await A(`/orders/${o.trackingId}/notes`, { method: 'POST', body: { text: 'Call before delivery' } })).status, 201);
  assert.equal((await A(`/orders/${o.trackingId}/notes`, { method: 'POST', body: { text: '' } })).status, 400);
  const adminView = await json(await A(`/orders/${o.trackingId}`));
  assert.equal(adminView.order.internalNotes[0].text, 'Call before delivery');
  const mine = await json(await call(`/api/orders/${o.trackingId}`, { cookie: customerCookie }));
  assert.equal(JSON.stringify(mine).includes('Call before delivery'), false);
});

test('orders list: search, status filter, date range, pagination', async () => {
  const o = await place(1);
  const byId = await json(await A(`/orders?q=${o.trackingId}`));
  assert.equal(byId.total, 1);
  const byName = await json(await A(`/orders?q=Buyer&status=pending&preset=today&limit=2`));
  assert.ok(byName.items.length <= 2 && byName.items.every((x) => x.status === 'pending'));
  assert.equal((await A('/orders?preset=custom&from=2026-02-30&to=2026-03-01')).status, 400);
  assert.equal((await A('/orders?limit=1000')).status, 400);
  assert.equal((await A('/orders?status=bogus')).status, 400);
});

test('dashboard keeps delivered, open, cancelled and gross money separate (diff-based)', async () => {
  const b = (await dash()).summary;
  const a1 = await place(1); const a2 = await place(2); const a3 = await place(1);
  await walk(a1.trackingId, ['confirmed', 'processing', 'shipped', 'delivered']);
  await walk(a3.trackingId, ['cancelled']);
  const after1 = await dash();
  const d = (f) => f(after1.summary) - f(b);
  assert.equal(d((s) => s.orders.total), 3);
  assert.equal(d((s) => s.orders.delivered), 1);
  assert.equal(d((s) => s.orders.cancelled), 1);
  assert.equal(d((s) => s.orders.pending), 1);
  assert.equal(d((s) => s.money.deliveredSales), a1.total);
  assert.equal(d((s) => s.money.openOrderValue), a2.total);
  assert.equal(d((s) => s.money.cancelledValue), a3.total);
  assert.equal(d((s) => s.money.grossOrderValue), a1.total + a2.total + a3.total);
  const m = after1.summary.money;
  assert.equal(m.grossOrderValue, m.deliveredSales + m.openOrderValue + m.cancelledValue);
  assert.ok(after1.profit.estimatedProfit !== null); // cost price is set on this product
  assert.ok(after1.trend.points.length >= 1 && after1.trend.granularity === 'day');
  assert.ok(Array.isArray(after1.bestsellers) && Array.isArray(after1.lowStock) && after1.recentOrders.length > 0);
});

test('estimated profit = (price - cost) x quantity of delivered items with a cost', async () => {
  const b = (await dash()).profit.estimatedProfit ?? 0;
  const o = await place(2); // price 500, cost 300 -> 400
  await walk(o.trackingId, ['confirmed', 'processing', 'shipped', 'delivered']);
  assert.equal(((await dash()).profit.estimatedProfit ?? 0) - b, 400);
});

test('sales report: grouping, pagination, validation', async () => {
  const r = await json(await A('/reports/sales?groupBy=month&preset=all&limit=3'));
  assert.equal(r.rows[0].period, dhakaMonthString(new Date()));
  assert.ok(r.rows.length <= 3 && r.totalPages >= 1);
  const row = r.rows[0];
  assert.equal(row.gross, row.deliveredSales + row.openValue + row.cancelledValue);
  const years = await json(await A('/reports/sales?groupBy=year&preset=all'));
  assert.match(years.rows[0].period, /^\d{4}$/);
  assert.equal((await A('/reports/sales?groupBy=week')).status, 400);
  assert.equal((await A('/reports/sales?preset=custom&from=2026-05-01&to=2026-04-01')).status, 400);
});

test('review moderation: approve shows publicly and updates rating; reject removes it', async () => {
  const buyer = await User.findOne({ phone: new RegExp(`^0151${tag}`) });
  const order = await Order.findOne({ idempotencyKey: new RegExp(`^t8-${tag}`), status: 'delivered' });
  const rev = await Review.create({ product: prod._id, user: buyer._id, order: order._id, rating: 4, comment: 'Good', status: 'pending' });
  assert.equal((await json(await call(`/api/products/${prod.slug}/reviews`))).total, 0);
  const list = await json(await A('/reviews?status=pending&limit=100'));
  assert.ok(list.items.some((x) => x.id === String(rev._id)));
  assert.equal((await A(`/reviews/${rev._id}`, { method: 'PATCH', body: { status: 'approved' } })).status, 200);
  const pub = await json(await call(`/api/products/${prod.slug}/reviews`));
  assert.equal(pub.total, 1); assert.equal(pub.average, 4); assert.equal(pub.count, 1);
  await A(`/reviews/${rev._id}`, { method: 'PATCH', body: { status: 'rejected' } });
  assert.equal((await json(await call(`/api/products/${prod.slug}/reviews`))).total, 0);
  assert.equal((await Product.findById(prod._id)).ratingCount, 0);
  assert.equal((await A(`/reviews/${rev._id}`, { method: 'DELETE' })).status, 200);
  assert.equal((await A(`/reviews/${rev._id}`, { method: 'DELETE' })).status, 404);
});

test('settings: delivery fees apply to new orders only; validation; public data stays safe', async () => {
  const old = await place(1);
  const r = await A('/settings', { method: 'PATCH', body: { delivery: { insideDhaka: 90 }, lowStockThreshold: 7, contact: { phone: '01700000000' } } });
  assert.equal(r.status, 200);
  const s = (await json(r)).settings;
  assert.equal(s.delivery.insideDhaka, 90);
  assert.equal(s.delivery.outsideDhaka, original.outsideDhaka); // untouched sibling
  assert.equal((await json(await call('/api/checkout/config'))).delivery.insideDhaka, 90);
  const fresh = await place(1);
  assert.equal(fresh.deliveryFee, 90);
  assert.equal((await json(await call(`/api/orders/${old.trackingId}`, { cookie: customerCookie }))).order.deliveryFee, old.deliveryFee); // old order unchanged
  assert.equal((await A('/settings', { method: 'PATCH', body: { delivery: { insideDhaka: -5 } } })).status, 400);
  assert.equal((await A('/settings', { method: 'PATCH', body: { delivery: { insideDhaka: 10.5 } } })).status, 400);
  assert.equal((await A('/settings', { method: 'PATCH', body: { metaPixelId: 'abc' } })).status, 400);
  assert.equal((await A('/settings', { method: 'PATCH', body: { contact: { facebook: 'http://x.example' } } })).status, 400);
  assert.equal((await A('/settings', { method: 'PATCH', body: { delivery: { insideDhaka: original.insideDhaka }, lowStockThreshold: 10 } })).status, 200);
});

test('customer management: list with stats, disable signs them out, admins excluded', async () => {
  const list = await json(await A(`/customers?q=${`0151${tag}`}`));
  assert.equal(list.total, 1);
  const c = list.items[0];
  assert.ok(c.orders >= 1);
  assert.equal(JSON.stringify(list).includes('passwordHash'), false);
  const everyone = await json(await A('/customers?limit=100'));
  assert.equal(everyone.items.some((x) => x.phone === ctx.adminPhone), false);
  assert.equal((await A(`/customers/${c.id}`, { method: 'PATCH', body: { isActive: false } })).status, 200);
  assert.equal((await call('/api/auth/me', { cookie: customerCookie })).status, 401); // existing session dies at once
  assert.equal((await A(`/customers/${c.id}`, { method: 'PATCH', body: { isActive: true } })).status, 200);
  assert.equal((await call('/api/auth/me', { cookie: customerCookie })).status, 200);
});
