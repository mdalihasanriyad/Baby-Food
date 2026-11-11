import { Router } from 'express';
import StoreSettings from '../models/StoreSettings.js';
import { asyncHandler } from '../utils/errors.js';
import { env } from '../config/env.js';
import { publicCache } from '../middleware/cache.js';

const router = Router();

// Public-safe subset only. Admin-only settings get their own protected route in Phase 8.
router.get('/public', publicCache, asyncHandler(async (_req, res) => {
  const s = await StoreSettings.getSingleton();
  res.json({
    delivery: { insideDhaka: s.delivery.insideDhaka, outsideDhaka: s.delivery.outsideDhaka },
    contact: { phone: s.contact?.phone ?? '', whatsapp: s.contact?.whatsapp ?? '', email: s.contact?.email ?? '', address: s.contact?.address ?? '', facebook: s.contact?.facebook ?? '', instagram: s.contact?.instagram ?? '' },
    about: { bn: s.about?.bn ?? '', en: s.about?.en ?? '' },
    metaPixelId: s.metaPixelId || env.META_PIXEL_ID || null, // admin setting first, then the environment variable
  });
}));

export default router;
