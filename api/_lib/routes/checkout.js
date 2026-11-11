import { Router } from 'express';
import StoreSettings from '../models/StoreSettings.js';
import { asyncHandler } from '../utils/errors.js';
import { noStore } from '../middleware/cache.js';
import { DISTRICTS } from '../constants/districts.js';
import { listProviders } from '../payments/index.js';

const router = Router();

// Not cached: the customer must always see the delivery fee that will really be charged.
router.get('/config', noStore, asyncHandler(async (_req, res) => {
  const s = await StoreSettings.getSingleton();
  res.json({ delivery: { insideDhaka: s.delivery.insideDhaka, outsideDhaka: s.delivery.outsideDhaka }, districts: DISTRICTS, paymentMethods: listProviders() });
}));

export default router;
