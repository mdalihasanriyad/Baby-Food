import Product from '../models/Product.js';
import Category from '../models/Category.js';
import StoreSettings from '../models/StoreSettings.js';
import { connectDB } from '../db/connect.js';
import { PUBLIC_FILTER } from '../services/catalog.js';
import { S } from './strings.js';
import { absUrl, breadcrumbJsonLd, esc, listingState, organizationJsonLd, pickLang, pickText, productJsonLd, truncate, urlFor, websiteJsonLd } from './meta.js';

const PRIVATE = ['/admin', '/account', '/cart', '/checkout', '/wishlist', '/login', '/register', '/order'];
const isPrivate = (p) => PRIVATE.some((x) => p === x || p.startsWith(`${x}/`));
const STATIC = { '/': 'home', '/shop': 'shop', '/baby-food': 'baby', '/adult-food': 'adult', '/about': 'about', '/contact': 'contact' };
const INDEX = 'index,follow,max-image-preview:large';

export const normalizePath = (p) => {
  const clean = p.toLowerCase().replace(/\/{2,}/g, '/').replace(/(.)\/+$/, '$1');
  return clean || '/';
};

const NAV = (lang) => [['/shop', S[lang].shop], ['/baby-food', S[lang].baby], ['/adult-food', S[lang].adult], ['/about', S[lang].about], ['/contact', S[lang].contact]];
const noscriptNav = (lang) => `<nav><ul>${NAV(lang).map(([h, l]) => `<li><a href="${h}">${esc(l)}</a></li>`).join('')}</ul></nav>`;
const langQs = (lang) => (lang === 'en' ? '?lang=en' : '');

// Builds everything the HTML layer needs for one URL: status, title, description, canonical, robots, structured data.
export async function resolvePage({ path, query, siteUrl }) {
  const lang = pickLang(query);
  const t = S[lang];
  const base = {
    lang, jsonLd: [], status: 200,
    og: { siteName: t.brand, locale: t.locale, image: `${siteUrl}/og-default.png`, imageWidth: '1200', imageHeight: '630', imageAlt: t.brand },
  };
  const alternatesFor = (p) => [{ lang: 'bn', href: urlFor(siteUrl, p) }, { lang: 'en', href: urlFor(siteUrl, p, { lang: 'en' }) }, { lang: 'x-default', href: urlFor(siteUrl, p) }];

  if (isPrivate(path)) { // account, cart, checkout, wishlist, login, admin...: never indexed
    return { ...base, title: t.private, description: t.homeDesc, canonical: urlFor(siteUrl, path), robots: 'noindex,nofollow', noscript: `<p>${esc(t.private)}</p>${noscriptNav(lang)}`, cache: 'private-page' };
  }

  const crumbs = (items) => breadcrumbJsonLd([{ name: t.home, url: urlFor(siteUrl, '/', { lang }) }, ...items]);

  // ---- static pages and listings ------------------------------------------------------------------
  if (STATIC[path]) {
    const kind = STATIC[path];
    const { filtered, page } = ['shop', 'baby', 'adult'].includes(kind) ? listingState(query) : { filtered: false, page: 1 };
    const names = { home: t.brand, shop: t.shop, baby: t.baby, adult: t.adult, about: t.about, contact: t.contact };
    const descs = { home: t.homeDesc, shop: t.shopDesc, baby: t.babyDesc, adult: t.adultDesc, about: t.aboutDesc, contact: t.contactDesc };
    let description = descs[kind];
    let settings = null;
    if (kind === 'home' || kind === 'about' || kind === 'contact') {
      try { await connectDB(); settings = await StoreSettings.getSingleton(); } catch { /* serve without settings */ }
    }
    if (kind === 'about' && settings?.about?.[lang]) description = truncate(settings.about[lang]);
    const pageSuffix = page > 1 ? ` — ${t.page} ${page}` : '';
    const title = kind === 'home' ? t.homeTitle : `${names[kind]}${pageSuffix} | ${t.brand}`;
    const jsonLd = [];
    if (kind === 'home') {
      jsonLd.push(organizationJsonLd({ siteUrl, name: t.brand, contact: settings?.contact ?? {} }), websiteJsonLd({ siteUrl, name: t.brand }));
    } else {
      jsonLd.push(crumbs([{ name: names[kind], url: urlFor(siteUrl, path, { lang }) }]));
    }
    return {
      ...base, title, description: truncate(description), robots: filtered ? 'noindex,follow' : INDEX,
      canonical: urlFor(siteUrl, path, { lang, page: filtered ? 1 : page }), // filtered variants point at the clean page
      alternates: filtered ? [] : alternatesFor(path), jsonLd,
      noscript: `<h1>${esc(names[kind] === t.brand ? t.homeTitle : names[kind])}</h1><p>${esc(truncate(description, 300))}</p>${noscriptNav(lang)}`,
      cache: 'public-page',
    };
  }

  // ---- product -------------------------------------------------------------------------------------
  const pm = path.match(/^\/product\/([a-z0-9-]{1,120})$/);
  if (pm) {
    const slug = pm[1];
    await connectDB();
    const p = await Product.findOne({ slug, ...PUBLIC_FILTER }).populate('category', 'slug name group').lean();
    if (!p) {
      const moved = await Product.findOne({ previousSlugs: slug, ...PUBLIC_FILTER }).select('slug').lean();
      if (moved) return { redirect: `/product/${moved.slug}${langQs(lang)}` }; // the slug changed: permanent redirect
      return notFound(base, t, siteUrl, lang);
    }
    const name = pickText(p.name, lang);
    const url = urlFor(siteUrl, path, { lang });
    const desc = pickText(p.description, lang);
    const description = truncate(p.seo?.metaDescription || desc || t.productFallback(name));
    const title = p.seo?.title || `${name} | ${p.brand ? `${p.brand} | ` : ''}${t.brand}`;
    const image = p.images?.[0] ? absUrl(siteUrl, p.images[0].url) : null;
    const cat = p.category;
    const trail = [];
    if (cat?.group === 'baby') trail.push({ name: t.baby, url: urlFor(siteUrl, '/baby-food', { lang }) });
    if (cat?.group === 'adult') trail.push({ name: t.adult, url: urlFor(siteUrl, '/adult-food', { lang }) });
    if (cat) trail.push({ name: pickText(cat.name, lang), url: urlFor(siteUrl, `/category/${cat.slug}`, { lang }) });
    trail.push({ name, url });
    const extra = [];
    if (!p.isDemo) { // price/availability tags only when the price is real
      extra.push(['product:price:amount', String(p.effectivePrice)], ['product:price:currency', 'BDT'], ['product:availability', p.stock > 0 ? 'in stock' : 'out of stock']);
    }
    return {
      ...base, title: truncate(title, 70), description, canonical: url, alternates: alternatesFor(path),
      robots: p.isDemo ? 'noindex,follow' : INDEX, // sample products must not be indexed
      og: { ...base.og, type: 'product', image: image ?? base.og.image, imageAlt: p.images?.[0]?.alt || name, imageWidth: image ? undefined : '1200', imageHeight: image ? undefined : '630', extra },
      preloadImage: image && image.includes('res.cloudinary.com') ? image.replace('/upload/', '/upload/f_auto,q_auto,w_800/') : image,
      jsonLd: [productJsonLd(p, { siteUrl, lang, url }), crumbs(trail)],
      noscript: `<h1>${esc(name)}</h1>${desc ? `<p>${esc(truncate(desc, 600))}</p>` : ''}${p.isDemo ? '' : `<p>৳${p.effectivePrice} — ${esc(p.stock > 0 ? t.inStock : t.outOfStock)}</p>`}${noscriptNav(lang)}`,
      cache: 'public-page',
    };
  }

  // ---- category ------------------------------------------------------------------------------------
  const cm = path.match(/^\/category\/([a-z0-9-]{1,100})$/);
  if (cm) {
    const slug = cm[1];
    await connectDB();
    const cat = await Category.findOne({ slug, isVisible: true }).lean();
    if (!cat) {
      const moved = await Category.findOne({ previousSlugs: slug, isVisible: true }).select('slug').lean();
      if (moved) return { redirect: `/category/${moved.slug}${langQs(lang)}` };
      return notFound(base, t, siteUrl, lang);
    }
    const { filtered, page } = listingState(query);
    const hasReal = await Product.exists({ category: cat._id, ...PUBLIC_FILTER, isDemo: { $ne: true } });
    const name = pickText(cat.name, lang);
    const description = truncate(pickText(cat.description, lang) || t.categoryFallback(name));
    const trail = [];
    if (cat.group === 'baby') trail.push({ name: t.baby, url: urlFor(siteUrl, '/baby-food', { lang }) });
    if (cat.group === 'adult') trail.push({ name: t.adult, url: urlFor(siteUrl, '/adult-food', { lang }) });
    trail.push({ name, url: urlFor(siteUrl, path, { lang }) });
    return {
      ...base, title: `${name}${page > 1 ? ` — ${t.page} ${page}` : ''} | ${t.brand}`, description,
      robots: !filtered && hasReal ? INDEX : 'noindex,follow', // categories holding only sample products stay out of the index
      canonical: urlFor(siteUrl, path, { lang, page: filtered ? 1 : page }), alternates: filtered ? [] : alternatesFor(path),
      og: { ...base.og, image: cat.image?.url ? absUrl(siteUrl, cat.image.url) : base.og.image, ...(cat.image?.url ? { imageWidth: undefined, imageHeight: undefined } : {}) },
      jsonLd: [crumbs(trail)], noscript: `<h1>${esc(name)}</h1><p>${esc(description)}</p>${noscriptNav(lang)}`, cache: 'public-page',
    };
  }

  return notFound(base, t, siteUrl, lang);
}

function notFound(base, t, siteUrl, lang) {
  return {
    ...base, status: 404, title: `${t.notFound} | ${t.brand}`, description: t.notFoundDesc, canonical: `${siteUrl}/`, robots: 'noindex,nofollow',
    noscript: `<h1>${esc(t.notFound)}</h1>${noscriptNav(lang)}`, cache: 'not-found',
  };
}

// Used when the database cannot be reached: the app still loads and shows its own error states.
export function genericPage({ query, siteUrl }) {
  const lang = pickLang(query);
  const t = S[lang];
  return {
    lang, status: 200, jsonLd: [], title: t.homeTitle, description: t.homeDesc, canonical: `${siteUrl}/`, robots: 'noindex,follow', cache: 'not-found',
    og: { siteName: t.brand, locale: t.locale, image: `${siteUrl}/og-default.png`, imageWidth: '1200', imageHeight: '630', imageAlt: t.brand },
    noscript: `<h1>${esc(t.brand)}</h1>${noscriptNav(lang)}`,
  };
}
