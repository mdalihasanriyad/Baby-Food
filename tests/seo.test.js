import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// A tiny stand-in for the built client shell (the real one is produced by `npm run build`).
const tpl = path.join(os.tmpdir(), `bfg-shell-${process.pid}.html`);
fs.writeFileSync(tpl, '<!doctype html><html lang="bn"><head><title>Default</title><meta name="description" content="default" /><!--seo-head--></head><body><div id="root"></div></body></html>');
process.env.SEO_TEMPLATE_PATH = tpl;
process.env.SITE_URL = 'https://shop.example.test';

const { setup } = await import('./helpers/setup.js');
const ctx = await setup();
if (!ctx) process.exit(0);
const { call, tag, cleanup } = ctx;
const { default: Product } = await import('../api/_lib/models/Product.js');
const { default: Category } = await import('../api/_lib/models/Category.js');
const SITE = 'https://shop.example.test';

let real; let demo; let draft; let catReal; let catDemo;
const mk = (n, extra = {}) => Product.create({
  slug: `zz-seo-${tag}-${n}`, sku: `ZZ-SEO-${tag}-${n}`, name: { bn: `এসইও ${n}`, en: `ZZ Seo ${n}` }, category: catReal._id,
  price: 500, stock: 4, isPublished: true, ...extra,
});
const page = (p, opts = {}) => call(p, { redirect: 'manual', raw: undefined, ...opts, headers: { 'Content-Type': 'text/html' } });

before(async () => {
  catReal = await Category.create({ name: { bn: 'ক', en: `ZZ Seo A ${tag}` }, slug: `zz-seo-a-${tag}`, group: 'baby' });
  catDemo = await Category.create({ name: { bn: 'খ', en: `ZZ Seo B ${tag}` }, slug: `zz-seo-b-${tag}`, group: 'baby' });
  real = await mk(1, { salePrice: 450, description: { bn: 'বিবরণ', en: 'A real description' }, brand: 'Acme', images: [{ url: 'https://res.cloudinary.com/demo/image/upload/a.jpg', alt: 'Front' }] });
  demo = await mk(2, { isDemo: true, category: catDemo._id });
  draft = await mk(3, { isPublished: false });
});
after(async () => {
  await Product.deleteMany({ sku: new RegExp(`^ZZ-SEO-${tag}`) });
  await Category.deleteMany({ slug: new RegExp(`^zz-seo-[ab]-${tag}`) });
  fs.rmSync(tpl, { force: true });
  await cleanup();
});

test('product page: server-rendered title, Open Graph, canonical, hreflang and structured data', async () => {
  const res = await page(`/product/${real.slug}`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  const html = await res.text();
  assert.match(html, /<html lang="bn">/);
  assert.match(html, /<title>[^<]*Acme[^<]*<\/title>/);
  assert.equal(html.includes('>Default<'), false);
  assert.ok(html.includes(`<link rel="canonical" href="${SITE}/product/${real.slug}" />`));
  assert.ok(html.includes('property="og:type" content="product"'));
  assert.ok(html.includes('property="og:image" content="https://res.cloudinary.com/demo/image/upload/a.jpg"'));
  assert.ok(html.includes('property="product:price:amount" content="450"'));
  assert.ok(html.includes('hreflang="en"'));
  assert.ok(html.includes('content="index,follow'));
  const ld = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
  const product = ld.find((o) => o['@type'] === 'Product');
  assert.equal(product.offers.price, '450');
  assert.equal(product.offers.availability, 'https://schema.org/InStock');
  assert.equal(product.aggregateRating, undefined);
  assert.ok(ld.some((o) => o['@type'] === 'BreadcrumbList'));
  assert.ok(html.includes('<noscript>'));
});

test('English variant has English metadata and a self-canonical', async () => {
  const html = await (await page(`/product/${real.slug}?lang=en`)).text();
  assert.match(html, /<html lang="en">/);
  assert.ok(html.includes(`<link rel="canonical" href="${SITE}/product/${real.slug}?lang=en" />`));
  assert.ok(html.includes('A real description'));
});

test('sample (demo) products are noindex and carry no offer data', async () => {
  const html = await (await page(`/product/${demo.slug}`)).text();
  assert.ok(html.includes('name="robots" content="noindex,follow"'));
  assert.equal(html.includes('"offers"'), false);
  assert.equal(html.includes('product:price:amount'), false);
});

test('unknown or unpublished products are a real 404; old slugs are a 301', async () => {
  const gone = await page(`/product/zz-nope-${tag}`);
  assert.equal(gone.status, 404);
  assert.ok((await gone.text()).includes('content="noindex,nofollow"'));
  assert.equal((await page(`/product/${draft.slug}`)).status, 404);
  await Product.updateOne({ _id: real._id }, { $set: { slug: `${real.slug}-new` }, $push: { previousSlugs: real.slug } });
  const moved = await page(`/product/${real.slug}`);
  assert.equal(moved.status, 301);
  assert.equal(moved.headers.get('location'), `/product/${real.slug}-new`);
  assert.equal((await page(`/product/${real.slug}-new`)).status, 200);
});

test('categories: indexable only when they hold real (non-demo) products', async () => {
  assert.ok((await (await page(`/category/${catReal.slug}`)).text()).includes('content="index,follow'));
  assert.ok((await (await page(`/category/${catDemo.slug}`)).text()).includes('content="noindex,follow"'));
  assert.equal((await page(`/category/zz-none-${tag}`)).status, 404);
});

test('listings: filters are noindex with a clean canonical; pagination keeps its own canonical', async () => {
  const filtered = await (await page('/shop?sort=price_asc&utm_source=facebook')).text();
  assert.ok(filtered.includes('content="noindex,follow"'));
  assert.ok(filtered.includes(`<link rel="canonical" href="${SITE}/shop" />`));
  const paged = await (await page('/shop?page=2&utm_source=facebook&fbclid=x')).text();
  assert.ok(paged.includes(`<link rel="canonical" href="${SITE}/shop?page=2" />`));
  assert.ok(paged.includes('content="index,follow'));
});

test('private areas are noindex; unknown paths are 404; URL forms are normalised', async () => {
  for (const p of ['/admin/orders', '/account/orders', '/cart', '/checkout', '/wishlist', '/login', '/order/BFG-1']) {
    const r = await page(p);
    assert.equal(r.status, 200, p);
    assert.ok((await r.text()).includes('content="noindex,nofollow"'), p);
  }
  assert.equal((await page('/definitely-not-a-page')).status, 404);
  const trailing = await page('/Shop/?page=2');
  assert.equal(trailing.status, 301);
  assert.equal(trailing.headers.get('location'), '/shop?page=2');
  const asset = await page('/assets/missing.js');
  assert.equal(asset.status, 404);
  assert.match(asset.headers.get('content-type'), /text\/plain/);
});

test('HTML responses ship a Content-Security-Policy that allows Cloudinary images and Meta Pixel only', async () => {
  const csp = (await page('/')).headers.get('content-security-policy');
  assert.match(csp, /img-src 'self' data: https:/);
  assert.match(csp, /script-src 'self' https:\/\/connect\.facebook\.net/);
  assert.match(csp, /object-src 'none'/);
});

test('sitemap: public indexable pages only (no demo, drafts, accounts, orders)', async () => {
  const xml = await (await call('/sitemap.xml')).text();
  assert.ok(xml.includes(`<loc>${SITE}/</loc>`));
  assert.ok(xml.includes(`${SITE}/product/${real.slug}-new`));
  assert.ok(xml.includes(`${SITE}/category/${catReal.slug}`));
  assert.equal(xml.includes(demo.slug), false);
  assert.equal(xml.includes(draft.slug), false);
  assert.equal(xml.includes(catDemo.slug), false);
  for (const bad of ['/admin', '/account', '/cart', '/checkout', '/order']) assert.equal(xml.includes(`${SITE}${bad}`), false, bad);
});

test('robots.txt points to the sitemap (crawling is blocked outside production)', async () => {
  const txt = await (await call('/robots.txt')).text();
  assert.match(txt, /^User-agent: \*/);
  assert.ok(txt.includes('Disallow: /')); // NODE_ENV=test is not production
});
