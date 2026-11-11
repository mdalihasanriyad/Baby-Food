import { Router } from 'express';
import StoreSettings from '../../models/StoreSettings.js';
import { asyncHandler } from '../../utils/errors.js';
import { validate } from '../../middleware/validate.js';
import { settingsUpdate } from '../../schemas/admin.js';

const router = Router();

const view = (s) => ({
  delivery: { insideDhaka: s.delivery.insideDhaka, outsideDhaka: s.delivery.outsideDhaka },
  contact: { phone: s.contact?.phone ?? '', whatsapp: s.contact?.whatsapp ?? '', email: s.contact?.email ?? '', address: s.contact?.address ?? '', facebook: s.contact?.facebook ?? '', instagram: s.contact?.instagram ?? '' },
  about: { bn: s.about?.bn ?? '', en: s.about?.en ?? '' },
  metaPixelId: s.metaPixelId ?? '', lowStockThreshold: s.lowStockThreshold, updatedAt: s.updatedAt,
});

// { a: { b: 1 } } -> [['a.b', 1]]; setting each leaf separately never wipes sibling fields.
function* leaves(obj, prefix = '') {
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) yield* leaves(v, `${prefix}${k}.`);
    else yield [`${prefix}${k}`, v];
  }
}

router.get('/', asyncHandler(async (_req, res) => res.json({ settings: view(await StoreSettings.getSingleton()) })));

// Delivery fees apply to NEW orders only: existing orders keep the fee they were placed with.
router.patch('/', validate(settingsUpdate), asyncHandler(async (req, res) => {
  const s = await StoreSettings.getSingleton();
  for (const [path, value] of leaves(req.valid)) s.set(path, value === '' ? undefined : value); // blank = clear
  await s.save();
  res.json({ settings: view(s) });
}));

export default router;
