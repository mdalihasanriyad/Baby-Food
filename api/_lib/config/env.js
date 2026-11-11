import { pickImageStorage, validateEnv } from './validate.js';

// Fail fast: a misconfigured production deployment stops here with a clear message (variable names only, never values).
const result = validateEnv(process.env);
if (!result.ok) {
  throw new Error(`Invalid environment configuration: ${result.errors.map((e) => `${e.name} ${e.message}`).join('; ')}`);
}

export const env = result.data;
export const isProd = env.NODE_ENV === 'production';
// 'local' writes to public/uploads (development only; git-ignored); 'cloudinary' is used whenever it is configured, and always in production.
export const imageStorage = pickImageStorage(env);

// Search engines may crawl only the real production site. Vercel preview/staging deployments and local runs stay hidden.
export const allowCrawling = isProd && (!process.env.VERCEL_ENV || process.env.VERCEL_ENV === 'production');
