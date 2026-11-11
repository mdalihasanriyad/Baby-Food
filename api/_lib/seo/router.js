import fs from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import { allowCrawling, env } from '../config/env.js';
import { connectDB } from '../db/connect.js';
import { asyncHandler } from '../utils/errors.js';
import { DIST_DIR, ROOT_DIR } from '../utils/paths.js';
import { PUBLIC_FILTER } from '../services/catalog.js';
import { HTML_CSP, buildHead, renderShell, robotsTxt, siteUrlFrom, sitemapXml, urlFor } from './meta.js';
import { genericPage, normalizePath, resolvePage } from './pages.js';

const router = Router();
export const siteUrl = () => siteUrlFrom(env.SITE_URL, env.APP_URL);

// The built frontend. `shell.html` is dist/index.html renamed after the build so the CDN never serves it directly at "/".
// (The last candidate, the source index.html, only exists for running the API from source without a build.)
const candidates = () => [
  env.SEO_TEMPLATE_PATH, path.join(DIST_DIR, 'shell.html'), path.join(DIST_DIR, 'index.html'), path.join(ROOT_DIR, 'index.html'),
].filter(Boolean);
let shell = null;
async function loadShell() {
  if (shell) return shell;
  for (const f of candidates()) {
    try { shell = await fs.readFile(f, 'utf8'); return shell; } catch { /* try next */ }
  }
  return null;
}

const CACHE = {
  'public-page': 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400',
  'private-page': 'public, max-age=0, s-maxage=3600',
  'not-found': 'public, max-age=0, s-maxage=60',
};

router.get('/robots.txt', (_req, res) => {
  res.set({ 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=3600' });
  res.send(robotsTxt({ siteUrl: siteUrl(), allowCrawling }));
});

// Public, indexable pages only: no accounts, orders, admin or carts. Demo/sample products are excluded.
router.get('/sitemap.xml', asyncHandler(async (_req, res) => {
  const site = siteUrl();
  await connectDB();
  const filter = { ...PUBLIC_FILTER, isDemo: { $ne: true } };
  const [products, catIds] = await Promise.all([
    Product.find(filter).sort({ updatedAt: -1 }).limit(49000).select('slug updatedAt').lean(),
    Product.distinct('category', filter),
  ]);
  const cats = await Category.find({ _id: { $in: catIds }, isVisible: true }).select('slug updatedAt').lean();
  const entries = [
    ...['/', '/shop', '/baby-food', '/adult-food', '/about', '/contact'].map((p) => ({ loc: urlFor(site, p) })),
    ...cats.map((c) => ({ loc: `${site}/category/${c.slug}`, lastmod: c.updatedAt })),
    ...products.map((p) => ({ loc: `${site}/product/${p.slug}`, lastmod: p.updatedAt })),
  ];
  res.set({ 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400' });
  res.send(sitemapXml(entries));
}));

// Every other page request: serve the client shell with server-generated metadata, correct HTTP status and redirects.
router.get('*', asyncHandler(async (req, res, next) => {
  const p = req.path;
  if (p.startsWith('/api') || p.startsWith('/uploads')) return next();
  if (p.includes('\\')) return res.status(404).type('text/plain').send('Not found'); // never echo or redirect paths with backslashes
  if (/\.[a-z0-9]{2,5}$/i.test(p)) return res.status(404).type('text/plain').send('Not found'); // a missing asset is not a page
  const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  const norm = normalizePath(p);
  if (norm !== p) return res.redirect(301, `${norm}${qs}`); // one canonical form: lowercase, no trailing slash

  const template = await loadShell();
  if (!template) return res.status(503).type('text/plain').send('The client app is not built. Run "npm run build" first.');

  const site = siteUrl();
  let page;
  try { page = await resolvePage({ path: norm, query: req.query, siteUrl: site }); } catch (err) {
    console.error(`seo: ${err.name} for ${norm}`);
    page = genericPage({ query: req.query, siteUrl: site });
  }
  if (page.redirect) return res.redirect(301, page.redirect);

  const html = renderShell(template, { lang: page.lang, headHtml: buildHead(page), noscriptHtml: page.noscript });
  res.set({
    'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': HTML_CSP, 'Cache-Control': CACHE[page.cache] ?? CACHE['public-page'],
    ...(!allowCrawling || /noindex/.test(page.robots) ? { 'X-Robots-Tag': 'noindex, nofollow' } : {}), // belt and braces next to the meta tag
  });
  res.status(page.status).send(html);
}));

export default router;
