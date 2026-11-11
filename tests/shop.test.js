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
const { recalcProductRating } = await import('../api/_lib/services/reviews.js');

let cat; let p1; let p2; let hidden; let customer;
const get = (path, cookie) => call(path, { cookie });
const mkProduct = (n, extra = {}) => Product.create({
  slug: `zz-shop-${tag}-${n}`, sku: `ZZ-SHOP-${tag}-${n}`, name: { bn: `পণ্য ${n}`, en: `ZZ Shop ${n}` }, category: cat._id,
  price: 100 * n, stock: 5, isPublished: true, ...extra,
});
const mkOrder = (status, product) => Order.create({
  user: customer._id, idempotencyKey: `k-${tag}-${Math.random()}`, status,
  items: [{ product: product._id, sku: product.sku, name: product.name, listPrice: product.price, unitPrice: product.price, quantity: 1, lineTotal: product.price }],
  customer: { name: 'T', phone: '01711111111', address: 'x', district: 'Dhaka' }, deliveryZone: 'inside_dhaka',
  subtotal: product.price, discountTotal: 0, deliveryFee: 70, total: product.price + 70,
});

before(async () => {
  customer = await User.findOne({ phone: new RegExp(`^0151${tag}`) });
  cat = await Category.create({ name: { bn: 'শপ', en: `ZZ Shop ${tag}` }, slug: `zz-shop-${tag}`, group: 'baby', isVisible: true });
  p1 = await mkProduct(1, { salePrice: 80, isFeatured: true });
  p2 = await mkProduct(2, { stock: 0 });
  hidden = await mkProduct(3, { isPublished: false });
});
after(async () => {
  await Review.deleteMany({ product: { $in: [p1?._id, p2?._id] } });
  await Order.deleteMany({ idempotencyKey: new RegExp(`^k-${tag}`) });
  await Product.deleteMany({ sku: new RegExp(`^ZZ-SHOP-${tag}`) });
  await Category.deleteMany({ slug: new RegExp(`^zz-shop-${tag}`) });
  await cleanup();
});

test('list: group filter, facets, lean payload, hidden products excluded', async () => {
  const r = await (await get(`/api/products?group=baby&limit=48`)).json();
  const slugs = r.items.map((i) => i.slug);
  assert.ok(slugs.includes(p1.slug) && slugs.includes(p2.slug));
  assert.ok(!slugs.includes(hidden.slug));
  assert.equal(typeof r.facets.maxPrice, 'number');
  const item = r.items.find((i) => i.slug === p1.slug);
  assert.equal(item.costPrice, undefined);
  assert.equal(item.description, undefined);
  const out = await (await get(`/api/products?category=zz-shop-${tag}&inStock=1`)).json();
  assert.deepEqual(out.items.map((i) => i.slug), [p1.slug]);
  assert.equal((await get('/api/products?group=nope')).status, 400);
});

test('home endpoint returns all sections', async () => {
  const h = await (await get('/api/home')).json();
  for (const k of ['featured', 'newArrivals', 'baby', 'adult', 'onSale', 'categories']) assert.ok(Array.isArray(h[k]), k);
});

test('category by slug, with redirect after a slug change', async () => {
  assert.equal((await get(`/api/categories/zz-shop-${tag}`)).status, 200);
  const r = await call(`/api/admin/categories/${cat._id}`, { method: 'PATCH', cookie: adminCookie, body: { slug: `zz-shop-${tag}-new` } });
  assert.equal(r.status, 200);
  assert.equal((await call(`/api/categories/zz-shop-${tag}`, { redirect: 'manual' })).status, 301);
  assert.equal((await get(`/api/categories/zz-shop-${tag}-new`)).status, 200);
});

test('related products exclude the product itself and hidden ones', async () => {
  const r = await (await get(`/api/products/${p1.slug}/related`)).json();
  const slugs = r.items.map((i) => i.slug);
  assert.ok(slugs.includes(p2.slug));
  assert.ok(!slugs.includes(p1.slug) && !slugs.includes(hidden.slug));
});

test('reviews: only delivered purchases, once per purchase, moderated before public', async () => {
  const review = (cookie, body) => call(`/api/products/${p1.slug}/reviews`, { method: 'POST', cookie, body });
  assert.equal((await review(undefined, { rating: 5 })).status, 401);
  assert.equal((await review(customerCookie, { rating: 5 })).status, 403); // no order yet

  const pending = await mkOrder('pending', p1);
  assert.equal((await review(customerCookie, { rating: 5 })).status, 403); // not delivered
  await Order.updateOne({ _id: pending._id }, { status: 'delivered', deliveredAt: new Date() });

  const elig = await (await get(`/api/products/${p1.slug}/review-eligibility`, customerCookie)).json();
  assert.equal(elig.eligible, true);
  assert.equal((await review(customerCookie, { rating: 6 })).status, 400);
  assert.equal((await review(customerCookie, { rating: 4, comment: 'Good' })).status, 201);
  assert.equal((await review(customerCookie, { rating: 5 })).status, 403); // same purchase already reviewed

  const after1 = await (await get(`/api/products/${p1.slug}/review-eligibility`, customerCookie)).json();
  assert.equal(after1.reason, 'already_reviewed');

  const pub = await (await get(`/api/products/${p1.slug}/reviews`)).json();
  assert.equal(pub.total, 0); // pending: not public
  await Review.updateMany({ product: p1._id }, { status: 'approved' });
  await recalcProductRating(p1._id);
  const pub2 = await (await get(`/api/products/${p1.slug}/reviews`)).json();
  assert.equal(pub2.total, 1);
  assert.equal(pub2.items[0].authorName, 'T'); // first name only
  assert.equal(pub2.average, 4);
  assert.equal(pub2.count, 1);
  assert.equal(pub2.items[0].user, undefined);
});

test('wishlist: private, add/remove, hidden products rejected', async () => {
  assert.equal((await get('/api/wishlist/ids')).status, 401);
  assert.equal((await call(`/api/wishlist/${p1._id}`, { method: 'PUT', cookie: adminCookie })).status, 401); // admin cookie is not a customer session
  assert.equal((await call(`/api/wishlist/${p1._id}`, { method: 'PUT', cookie: customerCookie })).status, 200);
  assert.equal((await call(`/api/wishlist/${p1._id}`, { method: 'PUT', cookie: customerCookie })).status, 200); // idempotent
  assert.equal((await call(`/api/wishlist/${hidden._id}`, { method: 'PUT', cookie: customerCookie })).status, 404);
  const ids = await (await get('/api/wishlist/ids', customerCookie)).json();
  assert.deepEqual(ids.ids, [String(p1._id)]);
  const full = await (await get('/api/wishlist', customerCookie)).json();
  assert.equal(full.items.length, 1);
  assert.equal((await call(`/api/wishlist/${p1._id}`, { method: 'DELETE', cookie: customerCookie })).status, 200);
  assert.deepEqual((await (await get('/api/wishlist/ids', customerCookie)).json()).ids, []);
});
