// Runs the API (and, after `npm run build`, the built site) on one local port:
//   npm run dev:api   during development (Vite serves the pages on 5173 and proxies /api here)
//   npm start         production preview of the whole site on http://localhost:5000
// On Vercel this file is not used: api/index.js exports the same app as a serverless function.
import app from '../api/_lib/app.js';
import { env, imageStorage } from '../api/_lib/config/env.js';
import { connectDB } from '../api/_lib/db/connect.js';
import { databaseSummary } from '../api/_lib/db/summary.js';
import { databaseHints } from '../api/_lib/db/hints.js';

const server = app.listen(env.PORT);
server.on('listening', () => console.log(`API listening on http://localhost:${env.PORT}  (product images: ${imageStorage})`));
server.on('error', (err) => {
  console.error(err.code === 'EADDRINUSE'
    ? `Port ${env.PORT} is already in use. Stop the other program using it, or set a different PORT in .env.`
    : `Could not start the API server: ${err.message}`);
  process.exit(1);
});

// Read-only startup report: is the database reachable, and does it actually contain data?
if (!env.MONGODB_URI) {
  console.log('Database: MONGODB_URI is not set, so database features will answer 503. Add it to .env.');
} else {
  try {
    await connectDB();
    const s = await databaseSummary();
    console.log(`Database: connected to "${s.name}": ${s.categories} categories, ${s.products} products (${s.published} published), ${s.customers} customers, ${s.admins} admins.`);
    for (const hint of databaseHints(s)) console.log(`  ! ${hint}`);
  } catch (err) {
    console.error(`Database: NOT reachable (${err.message}). Check MONGODB_URI, and that your current IP address is allowed in Atlas > Network Access.`);
  }
}
