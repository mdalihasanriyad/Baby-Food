import { Router } from 'express';
import mongoose from 'mongoose';
import { connectDB } from '../db/connect.js';
import { asyncHandler } from '../utils/errors.js';
import { noStore } from '../middleware/cache.js';

const router = Router();
router.use(noStore);

// Liveness: no database needed.
router.get('/', (_req, res) => {
  res.json({ ok: true, service: 'baby-food-gallery-api', time: new Date().toISOString() });
});

// Readiness: verifies the Atlas connection without exposing any connection details.
router.get('/db', asyncHandler(async (_req, res) => {
  await connectDB();
  await mongoose.connection.db.admin().ping();
  res.json({ ok: true, database: 'connected' });
}));

export default router;
