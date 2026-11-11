import { existsSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env, imageStorage } from './config/env.js';
import { DIST_DIR, UPLOAD_DIR } from './utils/paths.js';
import { allowedOrigins } from './utils/origins.js';
import { connectDB } from './db/connect.js';
import { sanitize } from './middleware/sanitize.js';
import { originGuard } from './middleware/originGuard.js';
import { apiLimiter } from './middleware/rateLimits.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { asyncHandler } from './utils/errors.js';
import health from './routes/health.js';
import routes from './routes/index.js';
import seo from './seo/router.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // Vercel / reverse proxies

// In development the site may be opened as localhost or 127.0.0.1; both are accepted. Production uses exactly APP_URL.
const origins = allowedOrigins(env.APP_URL, { development: env.NODE_ENV !== 'production' });

app.use(helmet());
app.use(cors({ origin: origins, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use('/api', originGuard(origins));
app.use(sanitize);
app.use('/api', apiLimiter);

if (imageStorage === 'local') app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d', index: false })); // dev only

app.use('/api/health', health); // works without a database
app.use('/api', asyncHandler(async (_req, _res, next) => { await connectDB(); next(); }));
app.use('/api', routes);

app.use('/api', notFound);

// Local production preview (`npm run build && npm start`): serve the built client's files. On Vercel the CDN does this.
if (!process.env.VERCEL && existsSync(DIST_DIR)) {
  app.use('/assets', express.static(path.join(DIST_DIR, 'assets'), { immutable: true, maxAge: '1y', index: false }));
  app.use(express.static(DIST_DIR, { index: false, maxAge: '1h' }));
}
app.use(seo); // robots.txt, sitemap.xml and the HTML pages with server-side metadata
app.use(errorHandler);

export default app;
