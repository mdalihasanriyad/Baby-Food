// Pure helpers (no database, no Express) so every rule here is unit-tested.

export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// JSON inside a <script> tag: "<" is escaped so data can never close the tag or inject markup.
export const safeJson = (o) => JSON.stringify(o).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

export function truncate(text, max = 155) {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t; 
  const cut = t.slice(0, max - 1);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:.-]+$/, '')}…`;
}

export const pickText = (o, lang) => (o?.[lang] || o?.en || o?.bn || '').trim();
export const absUrl = (siteUrl, u) => (!u ? '' : /^https?:\/\//i.test(u) ? u : `${siteUrl}${u.startsWith('/') ? '' : '/'}${u}`);

// The public, canonical origin. SITE_URL wins; otherwise the first allowed origin (APP_URL).
export function siteUrlFrom(siteUrl, appUrl) {
  const raw = siteUrl || String(appUrl ?? '').split(',')[0].trim() || 'http://localhost:5173';
  return raw.replace(/\/+$/, '');
}

// Language variants live on the same path with ?lang=en (Bengali is the default and has no parameter).
export function urlFor(siteUrl, path, { lang = 'bn', page = 1 } = {}) {
  const p = new URLSearchParams();
  if (page > 1) p.set('page', String(page));
  if (lang === 'en') p.set('lang', 'en');
  const qs = p.toString();
  return `${siteUrl}${path === '/' && !qs ? '' : path}${qs ? `?${qs}` : ''}`.replace(/^(https?:\/\/[^/?]+)$/, '$1/');
}

const FILTER_PARAMS = ['q', 'sort', 'max', 'stock', 'sale', 'category'];
// Filtered / sorted / searched listings are thin duplicates: keep them out of the index but let crawlers follow links.
export function listingState(query = {}) {
  const filtered = FILTER_PARAMS.some((k) => query[k] !== undefined && query[k] !== '');
  const n = Number.parseInt(query.page, 10);
  return { filtered, page: Number.isInteger(n) && n > 1 && n <= 1000 ? n : 1 };
}
export const pickLang = (query = {}) => (query.lang === 'en' ? 'en' : 'bn');

export function breadcrumbJsonLd(items) { // items: [{ name, url }]
  return {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: it.url })),
  };
}

export function productJsonLd(p, { siteUrl, lang, url }) {
  const ld = { '@context': 'https://schema.org', '@type': 'Product', name: pickText(p.name, lang), sku: p.sku, url };
  const desc = pickText(p.description, lang);
  if (desc) ld.description = desc; // only text the shop actually wrote
  const images = (p.images ?? []).map((i) => absUrl(siteUrl, i.url)).filter(Boolean);
  if (images.length) ld.image = images;
  if (p.brand) ld.brand = { '@type': 'Brand', name: p.brand };
  // Sample (demo) data must never be presented to search engines as a real offer or rating.
  if (!p.isDemo && Number.isInteger(p.effectivePrice) && p.effectivePrice > 0) {
    ld.offers = {
      '@type': 'Offer', url, priceCurrency: 'BDT', price: String(p.effectivePrice),
      availability: p.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    };
  }
  if (!p.isDemo && p.ratingCount > 0) ld.aggregateRating = { '@type': 'AggregateRating', ratingValue: p.ratingAverage, reviewCount: p.ratingCount };
  return ld;
}

export function organizationJsonLd({ siteUrl, name, contact = {} }) {
  const org = { '@context': 'https://schema.org', '@type': 'Organization', name, url: `${siteUrl}/`, logo: `${siteUrl}/logo-512.png` };
  if (contact.phone) org.contactPoint = { '@type': 'ContactPoint', telephone: contact.phone, contactType: 'customer service', areaServed: 'BD' };
  const same = [contact.facebook, contact.instagram].filter(Boolean);
  if (same.length) org.sameAs = same;
  return org;
}

export const websiteJsonLd = ({ siteUrl, name }) => ({
  '@context': 'https://schema.org', '@type': 'WebSite', name, url: `${siteUrl}/`,
  potentialAction: { '@type': 'SearchAction', target: `${siteUrl}/shop?q={search_term_string}`, 'query-input': 'required name=search_term_string' },
});

// Content-Security-Policy for the HTML pages (allows our own scripts, Cloudinary/https images, Meta Pixel).
export const HTML_CSP = [
  "default-src 'self'", "script-src 'self' https://connect.facebook.net", "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:", "img-src 'self' data: https:", "connect-src 'self' https://www.facebook.com https://connect.facebook.net",
  "frame-ancestors 'self'", "base-uri 'self'", "form-action 'self'", "object-src 'none'",
].join('; ');

export function buildHead({ lang, title, description, canonical, robots, alternates = [], og = {}, preloadImage, jsonLd = [] }) {
  const s = (name, content) => `<meta name="${name}" content="${esc(content)}" />`;
  const p = (prop, content) => `<meta property="${prop}" content="${esc(content)}" />`;
  const lines = [
    `<title>${esc(title)}</title>`,
    s('description', description),
    s('robots', robots),
    `<link rel="canonical" href="${esc(canonical)}" />`,
    ...alternates.map((a) => `<link rel="alternate" hreflang="${esc(a.lang)}" href="${esc(a.href)}" />`),
    p('og:type', og.type ?? 'website'), p('og:site_name', og.siteName ?? ''), p('og:title', title), p('og:description', description),
    p('og:url', canonical), p('og:locale', og.locale ?? (lang === 'en' ? 'en_US' : 'bn_BD')),
    ...(og.image ? [p('og:image', og.image), p('og:image:alt', og.imageAlt ?? title)] : []),
    ...(og.imageWidth ? [p('og:image:width', og.imageWidth), p('og:image:height', og.imageHeight)] : []),
    ...(og.extra ?? []).map(([k, v]) => p(k, v)),
    s('twitter:card', og.image ? 'summary_large_image' : 'summary'), s('twitter:title', title), s('twitter:description', description),
    ...(og.image ? [s('twitter:image', og.image)] : []),
    ...(preloadImage ? [`<link rel="preload" as="image" href="${esc(preloadImage)}" fetchpriority="high" />`] : []),
    ...jsonLd.map((o) => `<script type="application/ld+json">${safeJson(o)}</script>`),
  ];
  return lines.join('\n    ');
}

// Puts the generated head tags, <html lang> and a no-JS fallback into the built client shell.
export function renderShell(template, { lang, headHtml, noscriptHtml }) {
  let html = template
    .replace(/<html\b[^>]*>/i, `<html lang="${lang}">`)
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/<meta\s+name="description"[^>]*>/i, '');
  html = html.includes('<!--seo-head-->') ? html.replace('<!--seo-head-->', headHtml) : html.replace('</head>', `    ${headHtml}\n  </head>`);
  if (noscriptHtml) html = html.replace('<div id="root"></div>', `<div id="root"></div>\n    <noscript>${noscriptHtml}</noscript>`);
  return html;
}

export function robotsTxt({ siteUrl, allowCrawling }) {
  if (!allowCrawling) return 'User-agent: *\nDisallow: /\n'; // previews / staging stay out of search engines
  return [
    'User-agent: *', 'Disallow: /admin', 'Disallow: /account', 'Disallow: /cart', 'Disallow: /checkout', 'Disallow: /order',
    'Disallow: /wishlist', 'Disallow: /login', 'Disallow: /register', 'Disallow: /api/', 'Disallow: /shell.html', 'Allow: /',
    '', `Sitemap: ${siteUrl}/sitemap.xml`, '',
  ].join('\n');
}

export function sitemapXml(entries) { // entries: [{ loc, lastmod? }]
  const rows = entries.map((e) => `  <url><loc>${esc(e.loc)}</loc>${e.lastmod ? `<lastmod>${new Date(e.lastmod).toISOString()}</lastmod>` : ''}</url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join('\n')}\n</urlset>\n`;
}
