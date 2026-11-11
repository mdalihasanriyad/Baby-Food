// Creates every index the models declare (unique phone/email/SKU/slug, one-order-per-idempotency-key, TTL cleanup...).
// Safe to run any time (it never drops anything). Run it once after the first deployment:   npm run ensure-indexes
import { readdirSync } from 'node:fs';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../api/_lib/db/connect.js';

try {
  await connectDB();
  for (const f of readdirSync(new URL('../api/_lib/models/', import.meta.url))) if (f.endsWith('.js') && f !== 'constants.js') await import(`../api/_lib/models/${f}`);
  await import('../api/_lib/middleware/mongoRateLimitStore.js');
  for (const name of mongoose.modelNames()) {
    const model = mongoose.model(name);
    await model.init();
    const idx = await model.collection.indexes();
    console.log(`${name.padEnd(15)} ${idx.length} indexes`);
  }
  console.log('All indexes are in place.');
} catch (err) {
  console.error(`Failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  await disconnectDB();
}
