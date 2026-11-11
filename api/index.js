// The one Vercel serverless function. vercel.json sends every /api/* request and every page request here.
// Everything it needs lives in api/_lib (the leading underscore tells Vercel not to expose those files as routes).
// Locally the same app is run by scripts/serve.js, so development and production run identical code.
import app from './_lib/app.js';

export default app;
