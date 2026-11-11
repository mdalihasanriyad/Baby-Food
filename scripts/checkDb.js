import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../api/_lib/db/connect.js';
import { databaseSummary } from '../api/_lib/db/summary.js';
import { databaseHints } from '../api/_lib/db/hints.js';

try {
  await connectDB();
  await mongoose.connection.db.admin().ping();
  const s = await databaseSummary();
  console.log(`Connected to MongoDB (database: "${s.name}"). Ping OK.`);
  console.log(`  categories: ${s.categories}   products: ${s.products} (${s.published} published, ${s.demo} sample)   customers: ${s.customers}   admins: ${s.admins}`);
  for (const hint of databaseHints(s)) console.log(`  ! ${hint}`);
} catch (err) {
  console.error(`Connection check failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  await disconnectDB();
}
