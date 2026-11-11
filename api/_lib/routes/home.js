import { Router } from 'express';
import Category from '../models/Category.js';
import { asyncHandler } from '../utils/errors.js';
import { publicCache } from '../middleware/cache.js';
import { categoryIdsForGroup, listPublic } from '../services/catalog.js';

const router = Router();

// One request for the whole home page (fast on mobile). Public data only, so it is safe to cache.
router.get('/', publicCache, asyncHandler(async (_req, res) => {
  const [babyIds, adultIds] = await Promise.all([categoryIdsForGroup('baby'), categoryIdsForGroup('adult')]);
  const [featured, newArrivals, baby, adult, onSale, categories] = await Promise.all([
    listPublic({ isFeatured: true }, { createdAt: -1 }, 4),
    listPublic({}, { createdAt: -1 }, 4),
    listPublic({ category: { $in: babyIds } }, { soldCount: -1, createdAt: -1 }, 4),
    listPublic({ category: { $in: adultIds } }, { soldCount: -1, createdAt: -1 }, 4),
    listPublic({ salePrice: { $ne: null } }, { createdAt: -1 }, 4),
    Category.find({ isVisible: true }).sort({ sortOrder: 1, 'name.en': 1 }).select('slug name group image').lean(),
  ]);
  res.json({ featured, newArrivals, baby, adult, onSale, categories });
}));

export default router;
