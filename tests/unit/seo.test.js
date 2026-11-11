import { test } from 'node:test';
import assert from 'node:assert/strict';
import { absUrl, breadcrumbJsonLd, buildHead, esc, listingState, organizationJsonLd, pickLang, productJsonLd, renderShell, robotsTxt, safeJson, siteUrlFrom, sitemapXml, truncate, urlFor } from '../../api/_lib/seo/meta.js';

const SITE = 'https://babyfoodgallery.com';

test('escaping: attributes and JSON-LD cannot break out', () => {
  assert.equal(esc(`"><script>alert('x')</script>`), '&quot;&gt;&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;');
  assert.equal(safeJson({ a: '</script><b>' }).includes('</script>'), false);
  assert.deepEqual(JSON.parse(safeJson({ a: '</script>' })), { a: '</script>' }); // still valid JSON
});

test('truncate keeps whole words and adds an ellipsis', () => {
  assert.equal(truncate('short'), 'short');
  const out = truncate('word '.repeat(60), 50);
  assert.ok(out.length <= 50 && out.endsWith('…') && !out.includes('wor…'));
  assert.equal(truncate('  a   b  '), 'a b');
});

test('site url and canonical url building', () => {
  assert.equal(siteUrlFrom('https://x.com/', 'http://localhost:5173'), 'https://x.com');
  assert.equal(siteUrlFrom(undefined, 'https://a.com, https://www.a.com'), 'https://a.com');
  assert.equal(urlFor(SITE, '/'), `${SITE}/`);
  assert.equal(urlFor(SITE, '/shop'), `${SITE}/shop`);
  assert.equal(urlFor(SITE, '/shop', { page: 2 }), `${SITE}/shop?page=2`);
  assert.equal(urlFor(SITE, '/shop', { lang: 'en', page: 3 }), `${SITE}/shop?page=3&lang=en`);
  assert.equal(urlFor(SITE, '/', { lang: 'en' }), `${SITE}/?lang=en`);
  assert.equal(absUrl(SITE, '/uploads/a.png'), `${SITE}/uploads/a.png`);
  assert.equal(absUrl(SITE, 'https://res.cloudinary.com/x.jpg'), 'https://res.cloudinary.com/x.jpg');
});

test('listings: filters/sort/search are noindex, pagination is not; tracking params are ignored', () => {
  assert.deepEqual(listingState({}), { filtered: false, page: 1 });
  assert.deepEqual(listingState({ page: '2' }), { filtered: false, page: 2 });
  assert.equal(listingState({ sort: 'price_asc' }).filtered, true);
  assert.equal(listingState({ q: 'cerelac' }).filtered, true);
  assert.equal(listingState({ utm_source: 'facebook', fbclid: 'abc' }).filtered, false);
  assert.equal(listingState({ page: '-4' }).page, 1);
  assert.equal(listingState({ page: 'abc' }).page, 1);
  assert.equal(pickLang({ lang: 'en' }), 'en');
  assert.equal(pickLang({ lang: 'fr' }), 'bn');
});

test('product structured data: offers only for real (non-demo) prices; never invents data', () => {
  const real = { name: { bn: 'পণ্য', en: 'Thing' }, sku: 'T-1', brand: 'Acme', effectivePrice: 450, stock: 3, images: [{ url: '/uploads/a.png' }], ratingCount: 0, ratingAverage: 0, isDemo: false };
  const ld = productJsonLd(real, { siteUrl: SITE, lang: 'en', url: `${SITE}/product/thing` });
  assert.equal(ld.offers.price, '450');
  assert.equal(ld.offers.priceCurrency, 'BDT');
  assert.equal(ld.offers.availability, 'https://schema.org/InStock');
  assert.equal(ld.description, undefined); // no description written -> none invented
  assert.equal(ld.aggregateRating, undefined); // no reviews -> no rating
  assert.deepEqual(ld.image, [`${SITE}/uploads/a.png`]);
  assert.equal(productJsonLd({ ...real, stock: 0 }, { siteUrl: SITE, lang: 'en', url: 'u' }).offers.availability, 'https://schema.org/OutOfStock');
  assert.equal(productJsonLd({ ...real, isDemo: true, ratingCount: 5, ratingAverage: 4 }, { siteUrl: SITE, lang: 'en', url: 'u' }).offers, undefined);
  assert.equal(productJsonLd({ ...real, isDemo: true, ratingCount: 5, ratingAverage: 4 }, { siteUrl: SITE, lang: 'en', url: 'u' }).aggregateRating, undefined);
  const rated = productJsonLd({ ...real, ratingCount: 2, ratingAverage: 4.5, description: { bn: 'বিবরণ' } }, { siteUrl: SITE, lang: 'bn', url: 'u' });
  assert.deepEqual(rated.aggregateRating, { '@type': 'AggregateRating', ratingValue: 4.5, reviewCount: 2 });
  assert.equal(rated.description, 'বিবরণ');
});

test('breadcrumb and organization data', () => {
  const b = breadcrumbJsonLd([{ name: 'Home', url: `${SITE}/` }, { name: 'Shop', url: `${SITE}/shop` }]);
  assert.equal(b.itemListElement[1].position, 2);
  const org = organizationJsonLd({ siteUrl: SITE, name: 'BFG', contact: { phone: '01700000000', facebook: 'https://facebook.com/x' } });
  assert.equal(org.contactPoint.telephone, '01700000000');
  assert.deepEqual(org.sameAs, ['https://facebook.com/x']);
  assert.equal(organizationJsonLd({ siteUrl: SITE, name: 'BFG' }).contactPoint, undefined);
});

test('head tags: Open Graph, Twitter, hreflang, robots, escaped values', () => {
  const head = buildHead({
    lang: 'bn', title: 'A "quoted" <title>', description: 'Desc & more', canonical: `${SITE}/product/x`, robots: 'index,follow',
    alternates: [{ lang: 'bn', href: `${SITE}/product/x` }, { lang: 'en', href: `${SITE}/product/x?lang=en` }],
    og: { type: 'product', siteName: 'BFG', image: `${SITE}/p.jpg`, extra: [['product:price:amount', '450']] }, preloadImage: `${SITE}/p.jpg`,
    jsonLd: [{ '@type': 'Product', name: '</script>' }],
  });
  assert.ok(head.includes('<title>A &quot;quoted&quot; &lt;title&gt;</title>'));
  assert.ok(head.includes('property="og:type" content="product"'));
  assert.ok(head.includes('property="og:image" content="https://babyfoodgallery.com/p.jpg"'));
  assert.ok(head.includes('name="twitter:card" content="summary_large_image"'));
  assert.ok(head.includes('hreflang="en"'));
  assert.ok(head.includes('property="product:price:amount" content="450"'));
  assert.ok(head.includes('rel="preload" as="image"'));
  assert.equal((head.match(/<\/script>/g) ?? []).length, 1); // the data cannot close the script tag early
});

test('shell rendering replaces the default title/description and sets <html lang>', () => {
  const tpl = '<!doctype html><html lang="bn"><head><title>Old</title><meta name="description" content="old" /><!--seo-head--></head><body><div id="root"></div></body></html>';
  const out = renderShell(tpl, { lang: 'en', headHtml: '<title>New</title>', noscriptHtml: '<h1>Hi</h1>' });
  assert.ok(out.includes('<html lang="en">'));
  assert.equal(out.includes('Old'), false);
  assert.equal(out.includes('content="old"'), false);
  assert.ok(out.includes('<title>New</title>'));
  assert.ok(out.includes('<noscript><h1>Hi</h1></noscript>'));
  const noMarker = renderShell('<html><head></head><body><div id="root"></div></body></html>', { lang: 'bn', headHtml: '<title>T</title>' });
  assert.ok(noMarker.includes('<title>T</title>'));
});

test('robots.txt: blocks private areas and previews, links the sitemap', () => {
  const live = robotsTxt({ siteUrl: SITE, allowCrawling: true });
  for (const p of ['/admin', '/account', '/cart', '/checkout', '/api/']) assert.ok(live.includes(`Disallow: ${p}`), p);
  assert.ok(live.includes(`Sitemap: ${SITE}/sitemap.xml`));
  assert.equal(robotsTxt({ siteUrl: SITE, allowCrawling: false }), 'User-agent: *\nDisallow: /\n');
});

test('sitemap xml is valid and escaped', () => {
  const xml = sitemapXml([{ loc: `${SITE}/` }, { loc: `${SITE}/product/a&b`, lastmod: '2026-03-01T00:00:00Z' }]);
  assert.ok(xml.startsWith('<?xml'));
  assert.ok(xml.includes('<loc>https://babyfoodgallery.com/product/a&amp;b</loc>'));
  assert.ok(xml.includes('<lastmod>2026-03-01T00:00:00.000Z</lastmod>'));
});
