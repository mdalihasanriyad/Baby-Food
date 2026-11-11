import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './helpers/setup.js';

const ctx = await setup();
if (!ctx) process.exit(0);
const { call, adminCookie, customerCookie, tag, cleanup } = ctx;
const { default: Product } = await import('../api/_lib/models/Product.js');
const { default: Category } = await import('../api/_lib/models/Category.js');

const mk = (extra = {}) => ({
  name: { bn: 'টেস্ট', en: `ZZ Test ${tag}` }, sku: `zz-${tag}-1`, price: 500, stock: 10, isPublished: true, ...extra,
});
let catA; let catB; let product;
const admin = (path, opts = {}) => call(`/api/admin${path}`, { ...opts, cookie: adminCookie });

before(async () => {
  catA = (await (await admin('/categories', { method: 'POST', body: { name: { bn: 'ক', en: `ZZ A ${tag}` } } })).json()).item;
  catB = (await (await admin('/categories', { method: 'POST', body: { name: { bn: 'খ', en: `ZZ B ${tag}` } } })).json()).item;
});
after(async () => {
  await Product.deleteMany({ sku: new RegExp(`^ZZ-${tag}`) });
  await Category.deleteMany({ _id: { $in: [catA?._id, catB?._id] } });
  await cleanup();
});

test('customers and anonymous users cannot use admin catalog APIs', async () => {
  for (const [method, path] of [['GET', '/products'], ['POST', '/products'], ['GET', '/categories'], ['POST', '/uploads']]) {
    assert.equal((await call(`/api/admin${path}`, { method })).status, 401);
    assert.equal((await call(`/api/admin${path}`, { method, cookie: customerCookie })).status, 401);
  }
});

test('create product: validation rules', async () => {
  const bad = await admin('/products', { method: 'POST', body: mk({ category: catA._id, salePrice: 600 }) });
  assert.equal(bad.status, 400); // sale price must be lower
  const frac = await admin('/products', { method: 'POST', body: mk({ category: catA._id, price: 10.5 }) });
  assert.equal(frac.status, 400); // whole taka only
  const nocat = await admin('/products', { method: 'POST', body: mk({ category: '0'.repeat(24) }) });
  assert.equal(nocat.status, 400); // category must exist
  const noExt = await admin('/products', { method: 'POST', body: mk({ category: catA._id, images: [{ url: 'http://evil.example/x.png' }] }) });
  assert.equal(noExt.status, 400); // images must be https or /uploads/
});

test('create, duplicate SKU, update with effective price, slug redirect', async () => {
  const res = await admin('/products', { method: 'POST', body: mk({ category: catA._id, salePrice: 400 }) });
  assert.equal(res.status, 201);
  product = (await res.json()).item;
  assert.equal(product.effectivePrice, 400);
  assert.ok(product.slug.startsWith('zz-test-'));

  const dup = await admin('/products', { method: 'POST', body: mk({ category: catA._id, name: { bn: 'অন্য', en: 'Other' } }) });
  assert.equal(dup.status, 409);

  const upd = await admin(`/products/${product._id}`, { method: 'PATCH', body: { salePrice: null, slug: `zz-new-${tag}` } });
  assert.equal(upd.status, 200);
  assert.equal((await upd.json()).item.effectivePrice, 500);

  const old = await call(`/api/products/${product.slug}`, { redirect: 'manual' });
  assert.equal(old.status, 301);
  assert.equal((await call(`/api/products/zz-new-${tag}`)).status, 200);
});

test('public API hides unpublished/archived products and never leaks cost price', async () => {
  await admin(`/products/${product._id}`, { method: 'PATCH', body: { costPrice: 300 } });
  const pub = await (await call(`/api/products/zz-new-${tag}`)).json();
  assert.equal(pub.item.costPrice, undefined);
  const adm = await (await admin(`/products/${product._id}`)).json();
  assert.equal(adm.item.costPrice, 300);

  assert.equal((await admin(`/products/${product._id}/archive`, { method: 'POST' })).status, 200);
  assert.equal((await call(`/api/products/zz-new-${tag}`)).status, 404);
  assert.equal((await admin(`/products/${product._id}/restore`, { method: 'POST' })).status, 200);
  assert.equal((await call(`/api/products/zz-new-${tag}`)).status, 404); // restored but still unpublished
  await admin(`/products/${product._id}`, { method: 'PATCH', body: { isPublished: true } });
  assert.equal((await call(`/api/products/zz-new-${tag}`)).status, 200);
});

test('stock: set, adjust, and never below zero', async () => {
  const set = await admin(`/products/${product._id}/stock`, { method: 'PATCH', body: { stock: 5 } });
  assert.equal((await set.json()).stock, 5);
  const down = await admin(`/products/${product._id}/stock`, { method: 'PATCH', body: { delta: -3 } });
  assert.equal((await down.json()).stock, 2);
  assert.equal((await admin(`/products/${product._id}/stock`, { method: 'PATCH', body: { delta: -3 } })).status, 409);
  assert.equal((await admin(`/products/${product._id}/stock`, { method: 'PATCH', body: { stock: 1, delta: 1 } })).status, 400);
});

test('admin list: search, filters, pagination', async () => {
  const r = await (await admin(`/products?q=ZZ-${tag}&status=all&limit=5`)).json();
  assert.equal(r.total, 1);
  assert.equal(r.limit, 5);
  const none = await (await admin(`/products?q=ZZ-${tag}&stock=out&status=all`)).json();
  assert.equal(none.total, 0);
  assert.equal((await admin('/products?limit=9999')).status, 400);
});

test('categories: cannot delete while in use unless products are moved', async () => {
  const blocked = await admin(`/categories/${catA._id}`, { method: 'DELETE' });
  assert.equal(blocked.status, 409);
  assert.equal((await blocked.json()).error.code, 'CATEGORY_IN_USE');
  const self = await admin(`/categories/${catA._id}?reassignTo=${catA._id}`, { method: 'DELETE' });
  assert.equal(self.status, 400);
  const ok = await admin(`/categories/${catA._id}?reassignTo=${catB._id}`, { method: 'DELETE' });
  assert.equal(ok.status, 200);
  const moved = await (await admin(`/products/${product._id}`)).json();
  assert.equal(String(moved.item.category), String(catB._id));
});

test('uploads accept real images only (checked by file bytes)', async () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
  const ok = await admin('/uploads', { method: 'POST', raw: png, headers: { 'Content-Type': 'image/png' } });
  assert.equal(ok.status, 201);
  assert.match((await ok.json()).url, /^\/uploads\/[a-f0-9]{24}\.png$/);
  const fake = await admin('/uploads', { method: 'POST', raw: Buffer.from('<svg onload=alert(1)>'), headers: { 'Content-Type': 'image/png' } });
  assert.equal(fake.status, 415);
  const wrongType = await admin('/uploads', { method: 'POST', raw: png, headers: { 'Content-Type': 'image/svg+xml' } });
  assert.equal(wrongType.status, 415);
});

test('product with no orders can be deleted', async () => {
  assert.equal((await admin(`/products/${product._id}`, { method: 'DELETE' })).status, 200);
  assert.equal((await admin(`/products/${product._id}`)).status, 404);
});
