import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import StoreSettings from '../models/StoreSettings.js';
import { asyncHandler } from '../utils/errors.js';
import { validate } from '../middleware/validate.js';
import { noStore } from '../middleware/cache.js';
import { quoteSchema } from '../schemas/orders.js';
import { quoteCart } from '../services/cart.js';
import { feeFor } from '../services/orders.js';

const router = Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 200, standardHeaders: true, legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again later.' } }) });

// Public (guests can have carts). Returns current prices and stock; nothing private. Never cached.
router.post('/quote', noStore, limiter, validate(quoteSchema), asyncHandler(async (req, res) => {
  const { items, deliveryZone } = req.valid;
  const fee = deliveryZone ? feeFor(await StoreSettings.getSingleton(), deliveryZone) : null;
  res.json(await quoteCart(items, fee));
}));

export default router;
