import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './helpers/setup.js';

const ctx = await setup();
if (!ctx) process.exit(0);
const { call, adminCookie, customerCookie, tag, cleanup } = ctx;
const { default: Product } = await import('../api/_lib/models/Product.js');
const { default: Category } = await import('../api/_lib/models/Category.js');
const { default: Order } = await import('../api/_lib/models/Order.js');
const { default: User } = await import('../api/_lib/models/User.js');

let cat; let a; let b; let hidden; let cfg;
const otherPhone = `0141${tag}0`;
const mk = (n, extra = {}) => Product.create({
  slug: `zz-ord-${tag}-${n}`, sku: `ZZ-ORD-${tag}-${n}`, name: { bn: `অর্ডার ${n}`, en: `ZZ Order ${n}` }, category: cat._id,
  price: 500, stock: 10, isPublished: true, ...extra,
});
const stockOf = async (p) => (await Product.findById(p._id).select('stock')).stock;
let n = 0;
const body = (items, extra = {}) => ({
  items, deliveryZone: 'inside_dhaka', paymentMethod: 'cod', idempotencyKey: `t6-${tag}-${++n}-abcdefgh`,
  customer: { name: 'Test Buyer', phone: '01711111111', district: 'dhaka', address: 'House 1, Road 2' }, ...extra,
});
const place = (payload, cookie = customerCookie) => call('/api/orders', { method: 'POST', cookie, body: payload });

before(async () => {
  cat = await Category.create({ name: { bn: 'অ', en: `ZZ Ord ${tag}` }, slug: `zz-ord-${tag}` });
  a = await mk(1, { salePrice: 400, stock: 10 });
  b = await mk(2, { stock: 1 });
  hidden = await mk(3, { isPublished: false });
  cfg = await (await call('/api/checkout/config')).json();
});
after(async () => {
  await Order.deleteMany({ idempotencyKey: new RegExp(`^t6-${tag}`) });
  await Product.deleteMany({ sku: new RegExp(`^ZZ-ORD-${tag}`) });
  await Category.deleteMany({ slug: `zz-ord-${tag}` });
  await User.deleteMany({ phone: otherPhone });
  await cleanup();
});

test('checkout config exposes fees, 64 districts and COD only', async () => {
  assert.equal(cfg.districts.length, 64);
  assert.deepEqual(cfg.paymentMethods.map((m) => m.id), ['cod']);
  assert.equal(typeof cfg.delivery.insideDhaka, 'number');
});

test('quote prices from the database, flags stock problems, ignores client prices', async () => {
  const r = await (await call('/api/cart/quote', { method: 'POST', body: { items: [{ productId: String(a._id), quantity: 2, unitPrice: 1 }, { productId: String(b._id), quantity: 5 }, { productId: String(hidden._id), quantity: 1 }], deliveryZone: 'outside_dhaka' } })).json();
  const la = r.lines.find((l) => l.productId === String(a._id));
  const lb = r.lines.find((l) => l.productId === String(b._id));
  const lh = r.lines.find((l) => l.productId === String(hidden._id));
  assert.equal(la.unitPrice, 400); // not the 1 the client sent
  assert.equal(lb.status, 'adjusted'); assert.equal(lb.allowedQuantity, 1);
  assert.equal(lh.status, 'unavailable');
  assert.equal(r.subtotal, 400 * 2 + 500 * 1);
  assert.equal(r.discountTotal, 100 * 2);
  assert.equal(r.deliveryFee, cfg.delivery.outsideDhaka);
  assert.equal(r.total, r.subtotal + cfg.delivery.outsideDhaka);
  assert.equal(r.blocked, true);
});

test('orders require a customer session', async () => {
  assert.equal((await place(body([{ productId: String(a._id), quantity: 1 }]), undefined)).status, 401);
  assert.equal((await place(body([{ productId: String(a._id), quantity: 1 }]), adminCookie)).status, 401);
});

test('order totals, fee and prices come from the server; stock is deducted', async () => {
  const before1 = await stockOf(a);
  const res = await place(body([{ productId: String(a._id), quantity: 3, unitPrice: 1, price: 1 }], { deliveryFee: 0, total: 1 }));
  assert.equal(res.status, 201);
  const { order } = await res.json();
  assert.equal(order.subtotal, 1200);
  assert.equal(order.deliveryFee, cfg.delivery.insideDhaka);
  assert.equal(order.total, 1200 + cfg.delivery.insideDhaka);
  assert.equal(order.discountTotal, 300);
  assert.equal(order.status, 'pending');
  assert.match(order.trackingId, /^BFG-[A-F0-9]{16}$/);
  assert.equal(order.customer.district, 'Dhaka');
  assert.equal(await stockOf(a), before1 - 3);
});

test('the zone must match the district', async () => {
  const bad = await place(body([{ productId: String(a._id), quantity: 1 }], { customer: { name: 'Test Buyer', phone: '01711111111', district: 'sylhet', address: 'House 1, Road 2' } }));
  assert.equal(bad.status, 400); // inside_dhaka + Sylhet
  const ok = await place(body([{ productId: String(a._id), quantity: 1 }], { deliveryZone: 'outside_dhaka', customer: { name: 'Test Buyer', phone: '01711111111', district: 'sylhet', address: 'House 1, Road 2' } }));
  assert.equal(ok.status, 201);
  assert.equal((await ok.json()).order.deliveryFee, cfg.delivery.outsideDhaka);
});

test('validation: phone, address, unknown payment method', async () => {
  const items = [{ productId: String(a._id), quantity: 1 }];
  assert.equal((await place(body(items, { customer: { name: 'T B', phone: '123', district: 'dhaka', address: 'House 1, Road 2' } }))).status, 400);
  assert.equal((await place(body(items, { customer: { name: 'T B', phone: '01711111111', district: 'dhaka', address: 'x' } }))).status, 400);
  assert.equal((await place(body(items, { paymentMethod: 'bkash' }))).status, 400);
  assert.equal((await place(body([]))).status, 400);
});

test('duplicate submissions (same idempotency key) create one order and deduct stock once', async () => {
  const payload = body([{ productId: String(a._id), quantity: 2 }]);
  const s0 = await stockOf(a);
  const [r1, r2] = await Promise.all([place(payload), place(payload)]);
  const o1 = (await r1.json()).order; const o2 = (await r2.json()).order;
  assert.equal(o1.trackingId, o2.trackingId);
  assert.equal(await Order.countDocuments({ idempotencyKey: payload.idempotencyKey }), 1);
  assert.equal(await stockOf(a), s0 - 2);
  const again = await place(payload);
  assert.equal(again.status, 200);
  assert.equal((await again.json()).duplicate, true);
});

test('insufficient stock: 409, nothing is deducted, no partial order', async () => {
  const sa = await stockOf(a); const sb = await stockOf(b);
  const res = await place(body([{ productId: String(a._id), quantity: 1 }, { productId: String(b._id), quantity: 5 }]));
  assert.equal(res.status, 409);
  const err = (await res.json()).error;
  assert.equal(err.code, 'STOCK_CHANGED');
  assert.equal(err.details.items[0].available, 1);
  assert.equal(await stockOf(a), sa); assert.equal(await stockOf(b), sb);
  assert.equal((await place(body([{ productId: String(hidden._id), quantity: 1 }]))).status, 409); // unpublished
});

test('the last unit cannot be sold twice (race)', async () => {
  const last = await mk(4, { stock: 1 });
  const items = [{ productId: String(last._id), quantity: 1 }];
  const results = await Promise.all([place(body(items)), place(body(items)), place(body(items))]);
  const codes = results.map((r) => r.status).sort();
  assert.deepEqual(codes, [201, 409, 409]);
  assert.equal(await stockOf(last), 0);
});

test('customers can only read their own orders', async () => {
  const mine = (await (await place(body([{ productId: String(a._id), quantity: 1 }]))).json()).order;
  assert.equal((await call(`/api/orders/${mine.trackingId}`, { cookie: customerCookie })).status, 200);
  const reg = await call('/api/auth/register', { method: 'POST', body: { name: 'Other Person', phone: otherPhone, password: 'Test1234pass', confirmPassword: 'Test1234pass' } });
  const otherCookie = reg.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  assert.equal((await call(`/api/orders/${mine.trackingId}`, { cookie: otherCookie })).status, 404);
  assert.equal((await call(`/api/orders/${mine.trackingId}`)).status, 401);
  const view = await (await call(`/api/orders/${mine.trackingId}`, { cookie: customerCookie })).json();
  assert.equal(view.order.internalNotes, undefined);
  assert.equal(view.order.user, undefined);
  assert.equal(view.order.idempotencyKey, undefined);
});
