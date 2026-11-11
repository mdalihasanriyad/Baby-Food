// Environment validation as a pure function (no dependencies, no side effects) so every rule is unit-tested.
// Messages never include the values themselves: secrets must not end up in logs.
const PLACEHOLDER = /change.?me|replace|placeholder|example|your[_-]|<[^>]*>/i;

export function validateEnv(raw = {}) {
  const errors = [];
  const warnings = [];
  const bad = (name, message) => errors.push({ name, message });
  const warn = (name, message) => warnings.push({ name, message });
  const str = (k) => (raw[k] === undefined || String(raw[k]).trim() === '' ? undefined : String(raw[k]).trim());

  const NODE_ENV = str('NODE_ENV') ?? 'development';
  if (!['development', 'test', 'production'].includes(NODE_ENV)) bad('NODE_ENV', 'must be development, test or production');
  const prod = NODE_ENV === 'production';

  const PORT = Number(str('PORT') ?? 5000);
  if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) bad('PORT', 'must be a whole number between 1 and 65535');

  const origin = (value, name) => {
    try {
      const u = new URL(value);
      if (!['http:', 'https:'].includes(u.protocol)) throw new Error('protocol');
      if (u.pathname !== '/' || u.search || u.hash) warn(name, `"${u.origin}" is used; remove the path or query from the address`);
      return u.origin;
    } catch {
      bad(name, 'must be a web address like https://babyfoodgallery.com');
      return null;
    }
  };

  const APP_URL = str('APP_URL') ?? 'http://localhost:5173';
  const appOrigins = APP_URL.split(',').map((s) => s.trim()).filter(Boolean).map((o) => origin(o, 'APP_URL')).filter(Boolean);
  const SITE_URL = str('SITE_URL');
  const siteOrigin = SITE_URL ? origin(SITE_URL, 'SITE_URL') : null;

  const MONGODB_URI = str('MONGODB_URI');
  const JWT_SECRET = str('JWT_SECRET');
  const IMAGE_STORAGE = str('IMAGE_STORAGE');
  const META_PIXEL_ID = str('META_PIXEL_ID');
  const CLOUDINARY_CLOUD_NAME = str('CLOUDINARY_CLOUD_NAME');
  const CLOUDINARY_API_KEY = str('CLOUDINARY_API_KEY');
  const CLOUDINARY_API_SECRET = str('CLOUDINARY_API_SECRET');

  if (IMAGE_STORAGE && !['local', 'cloudinary'].includes(IMAGE_STORAGE)) bad('IMAGE_STORAGE', 'must be local or cloudinary');
  if (META_PIXEL_ID && !/^\d{5,20}$/.test(META_PIXEL_ID)) bad('META_PIXEL_ID', 'must be 5-20 digits');
  if (CLOUDINARY_CLOUD_NAME && !/^[a-z0-9_-]+$/i.test(CLOUDINARY_CLOUD_NAME)) bad('CLOUDINARY_CLOUD_NAME', 'may only contain letters, digits, - and _');
  if (JWT_SECRET && JWT_SECRET.length < 32) bad('JWT_SECRET', 'must be at least 32 characters');
  if (MONGODB_URI && !/^mongodb(\+srv)?:\/\//.test(MONGODB_URI)) bad('MONGODB_URI', 'must start with mongodb:// or mongodb+srv://');

  if (prod) {
    if (!MONGODB_URI) bad('MONGODB_URI', 'is required in production');
    else if (/[<>]/.test(MONGODB_URI)) bad('MONGODB_URI', 'still contains a placeholder such as <db-password>');
    if (!JWT_SECRET) bad('JWT_SECRET', 'is required in production');
    else if (PLACEHOLDER.test(JWT_SECRET) || new Set(JWT_SECRET).size < 8) bad('JWT_SECRET', 'looks like a placeholder or is too repetitive; generate a random one');
    if (!SITE_URL) bad('SITE_URL', 'is required in production (for canonical links, share previews and the sitemap)');
    else if (siteOrigin && !siteOrigin.startsWith('https://')) bad('SITE_URL', 'must use https:// in production');
    // The browser sends its own address as the Origin of every login/order request; anything not listed is refused (403).
    if (siteOrigin && !appOrigins.includes(siteOrigin)) bad('APP_URL', 'must include the SITE_URL address, otherwise every login and order request is rejected');
    if (appOrigins.some((o) => !o.startsWith('https://'))) warn('APP_URL', 'contains a non-https address');
    if (siteOrigin && !/\/\/www\./.test(siteOrigin) && !appOrigins.some((o) => o.includes('//www.'))) warn('APP_URL', 'does not include the www. version; if visitors can reach www., add it or redirect www to the main address');
    if (IMAGE_STORAGE === 'local') bad('IMAGE_STORAGE', 'local storage does not work on Vercel (read-only disk); use cloudinary');
    if ((IMAGE_STORAGE ?? 'cloudinary') === 'cloudinary' && !(CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET)) {
      warn('CLOUDINARY_*', 'incomplete: the shop works, but product image uploads will fail until all three are set');
    }
  } else {
    if (!MONGODB_URI) warn('MONGODB_URI', 'not set: database features will answer 503 until you set it');
    if (!JWT_SECRET) warn('JWT_SECRET', 'not set: login and admin sessions will answer 503 until you set it');
  }

  return {
    ok: errors.length === 0, errors, warnings,
    data: { NODE_ENV, PORT, APP_URL, MONGODB_URI, SITE_URL, META_PIXEL_ID, SEO_TEMPLATE_PATH: str('SEO_TEMPLATE_PATH'), IMAGE_STORAGE, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, JWT_SECRET },
  };
}

// Which image storage is used. An explicit IMAGE_STORAGE always wins. Otherwise: Cloudinary whenever all three credentials
// are present (so adding them to .env just works), else Cloudinary in production, else local disk (development only).
export function pickImageStorage(d) {
  if (d.IMAGE_STORAGE) return d.IMAGE_STORAGE;
  if (d.CLOUDINARY_CLOUD_NAME && d.CLOUDINARY_API_KEY && d.CLOUDINARY_API_SECRET) return 'cloudinary';
  return d.NODE_ENV === 'production' ? 'cloudinary' : 'local';
}
