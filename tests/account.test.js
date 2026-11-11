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

const otherPhone = `0131${tag}0`;
const takenPhone = `0191${tag}0`;
const PASS = 'Test1234pass';
let cat; let p; let otherCookie; let n = 0;
const stockOf = async () => (await Product.findById(p._id).select('stock')).stock;
const place = async (qty = 1, cookie = customerCookie) => {
  const res = await call('/api/orders', { method: 'POST', cookie, body: {
    items: [{ productId: String(p._id), quantity: qty }], deliveryZone: 'inside_dhaka', paymentMethod: 'cod', idempotencyKey: `t7-${tag}-${++n}-abcdefgh`,
    customer: { name: 'Buyer', phone: '01711111111', district: 'dhaka', address: 'House 1, Road 2' } } });
  assert.equal(res.status, 201);
  return (await res.json()).order;
};

before(async () => {
  cat = await Category.create({ name: { bn: 'ক', en: `ZZ Acc ${tag}` }, slug: `zz-acc-${tag}` });
  p = await Product.create({ slug: `zz-acc-${tag}`, sku: `ZZ-ACC-${tag}`, name: { bn: 'অ্যাকাউন্ট', en: 'ZZ Account' }, category: cat._id, price: 200, stock: 20, isPublished: true });
  const reg = await call('/api/auth/register', { method: 'POST', body: { name: 'Other Person', phone: otherPhone, password: PASS, confirmPassword: PASS } });
  otherCookie = reg.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  await User.create({ name: 'Taken', phone: takenPhone, passwordHash: 'x', role: 'customer' });
});
after(async () => {
  await Review.deleteMany({ product: p?._id });
  await Order.deleteMany({ idempotencyKey: new RegExp(`^t7-${tag}`) });
  await Product.deleteMany({ sku: `ZZ-ACC-${tag}` });
  await Category.deleteMany({ slug: `zz-acc-${tag}` });
  await User.deleteMany({ phone: { $in: [otherPhone, takenPhone] } });
  await cleanup();
});

test('order history lists only my orders, paginated, filterable', async () => {
  const mine = await place(1);
  await place(1);
  const list = await (await call('/api/orders?limit=1', { cookie: customerCookie })).json();
  assert.equal(list.items.length, 1);
  assert.ok(list.total >= 2);
  assert.ok(list.totalPages >= 2);
  assert.ok(list.items[0].itemCount >= 1);
  const other = await (await call('/api/orders', { cookie: otherCookie })).json();
  assert.equal(other.total, 0); // the other customer sees none of them
  assert.equal(other.items.some((o) => o.trackingId === mine.trackingId), false);
  const filtered = await (await call('/api/orders?status=delivered', { cookie: customerCookie })).json();
  assert.equal(filtered.total, 0);
  assert.equal((await call('/api/orders?status=hacked', { cookie: customerCookie })).status, 400);
  assert.equal((await call('/api/orders')).status, 401);
  assert.equal((await call('/api/orders', { cookie: adminCookie })).status, 401);
});

test('cancel: restores stock, records history, only once', async () => {
  const before1 = await stockOf();
  const o = await place(3);
  assert.equal(await stockOf(), before1 - 3);
  assert.equal(o.canCancel, true);
  const r = await call(`/api/orders/${o.trackingId}/cancel`, { method: 'POST', cookie: customerCookie, body: { reason: 'Changed my mind' } });
  assert.equal(r.status, 200);
  const done = (await r.json()).order;
  assert.equal(done.status, 'cancelled');
  assert.equal(done.canCancel, false);
  assert.deepEqual(done.statusHistory.map((h) => h.status), ['pending', 'cancelled']);
  assert.equal(await stockOf(), before1); // stock is back
  const again = await call(`/api/orders/${o.trackingId}/cancel`, { method: 'POST', cookie: customerCookie });
  assert.equal(again.status, 409);
  assert.equal(await stockOf(), before1); // not restored twice
});

test('concurrent cancels restore stock exactly once', async () => {
  const before1 = await stockOf();
  const o = await place(2);
  const rs = await Promise.all([1, 2, 3].map(() => call(`/api/orders/${o.trackingId}/cancel`, { method: 'POST', cookie: customerCookie })));
  assert.deepEqual(rs.map((r) => r.status).sort(), [200, 409, 409]);
  assert.equal(await stockOf(), before1);
});

test('cancel rules: not after processing, not other people\'s orders', async () => {
  const o = await place(1);
  await Order.updateOne({ trackingId: o.trackingId }, { status: 'processing' });
  const s0 = await stockOf();
  assert.equal((await call(`/api/orders/${o.trackingId}/cancel`, { method: 'POST', cookie: customerCookie })).status, 409);
  assert.equal(await stockOf(), s0);
  const o2 = await place(1);
  assert.equal((await call(`/api/orders/${o2.trackingId}/cancel`, { method: 'POST', cookie: otherCookie })).status, 404);
  assert.equal((await call(`/api/orders/${o2.trackingId}`, { cookie: otherCookie })).status, 404);
  assert.equal((await call(`/api/orders/${o2.trackingId}/cancel`, { method: 'POST' })).status, 401);
  const still = await (await call(`/api/orders/${o2.trackingId}`, { cookie: customerCookie })).json();
  assert.equal(still.order.status, 'pending');
});

test('profile: name is free to change; phone/email need the current password', async () => {
  const base = { name: 'New Name', phone: '01711111111' };
  const me = await (await call('/api/auth/me', { cookie: customerCookie })).json();
  const keep = { name: 'New Name', phone: me.user.phone };
  assert.equal((await call('/api/account/profile', { method: 'PATCH', cookie: customerCookie, body: keep })).status, 200);
  const noPw = await call('/api/account/profile', { method: 'PATCH', cookie: customerCookie, body: { ...keep, email: `x${tag}@example.test` } });
  assert.equal(noPw.status, 400);
  assert.equal((await noPw.json()).error.details[0].message, 'password_required');
  const wrongPw = await call('/api/account/profile', { method: 'PATCH', cookie: customerCookie, body: { ...keep, email: `x${tag}@example.test`, currentPassword: 'Wrong1234pass' } });
  assert.equal((await wrongPw.json()).error.details[0].message, 'password_incorrect');
  const dup = await call('/api/account/profile', { method: 'PATCH', cookie: customerCookie, body: { name: 'New Name', phone: takenPhone, currentPassword: PASS } });
  assert.equal(dup.status, 409);
  const ok = await call('/api/account/profile', { method: 'PATCH', cookie: customerCookie, body: { ...keep, email: `x${tag}@example.test`, currentPassword: PASS } });
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).user.email, `x${tag}@example.test`);
  void base;
});

test('change password: verifies current, signs out other sessions, keeps this one', async () => {
  const login = await call('/api/auth/login', { method: 'POST', body: { identifier: otherPhone, password: PASS } });
  const oldCookie = login.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  await new Promise((r) => setTimeout(r, 1100)); // token timestamps have 1-second resolution

  const wrong = await call('/api/account/password', { method: 'POST', cookie: oldCookie, body: { currentPassword: 'Nope1234pass', newPassword: 'Newer1234pass', confirmPassword: 'Newer1234pass' } });
  assert.equal(wrong.status, 400);
  const weak = await call('/api/account/password', { method: 'POST', cookie: oldCookie, body: { currentPassword: PASS, newPassword: 'short', confirmPassword: 'short' } });
  assert.equal(weak.status, 400);
  const ok = await call('/api/account/password', { method: 'POST', cookie: oldCookie, body: { currentPassword: PASS, newPassword: 'Newer1234pass', confirmPassword: 'Newer1234pass' } });
  assert.equal(ok.status, 200);
  const fresh = ok.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');

  assert.equal((await call('/api/auth/me', { cookie: oldCookie })).status, 401); // the old session is dead
  assert.equal((await call('/api/auth/me', { cookie: fresh })).status, 200); // this browser stays signed in
  assert.equal((await call('/api/auth/login', { method: 'POST', body: { identifier: otherPhone, password: PASS } })).status, 401);
  assert.equal((await call('/api/auth/login', { method: 'POST', body: { identifier: otherPhone, password: 'Newer1234pass' } })).status, 200);
});

test('my reviews: delivered purchases appear as reviewable until reviewed', async () => {
  const o = await place(1);
  assert.equal((await (await call('/api/account/reviews', { cookie: customerCookie })).json()).reviewable.some((r) => r.trackingId === o.trackingId), false); // not delivered yet
  await Order.updateOne({ trackingId: o.trackingId }, { status: 'delivered', deliveredAt: new Date() });
  const before1 = await (await call('/api/account/reviews', { cookie: customerCookie })).json();
  assert.ok(before1.reviewable.some((r) => r.slug === p.slug));
  const post = await call(`/api/products/${p.slug}/reviews`, { method: 'POST', cookie: customerCookie, body: { rating: 5, comment: 'Nice' } });
  assert.equal(post.status, 201);
  const after1 = await (await call('/api/account/reviews', { cookie: customerCookie })).json();
  assert.ok(after1.reviews.some((r) => r.product.slug === p.slug && r.status === 'pending'));
  assert.equal(after1.reviewable.some((r) => r.slug === p.slug), false);
  assert.equal((await call('/api/account/reviews', { cookie: otherCookie })).status, 200);
  assert.equal((await (await call('/api/account/reviews', { cookie: otherCookie })).json()).reviews.length, 0);
  assert.equal((await call('/api/account/reviews')).status, 401);
});
