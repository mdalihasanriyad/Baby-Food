import { isProd } from '../config/env.js';

// Only for PUBLIC catalog data (no user-specific content). Everything else stays uncached.
// In development nothing is cached, so data you just added (e.g. with `npm run seed`) shows up on the next refresh.
export const publicCacheHeader = (production) => (production ? 'public, max-age=60, s-maxage=300, stale-while-revalidate=600' : 'no-store');
export const publicCache = (_req, res, next) => {
  res.set('Cache-Control', publicCacheHeader(isProd));
  next();
};
export const noStore = (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
};
