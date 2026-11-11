import { Router } from 'express';
import Category from '../models/Category.js';
import { AppError, asyncHandler } from '../utils/errors.js';
import { SLUG_RE } from '../models/constants.js';
import { publicCache } from '../middleware/cache.js';

const router = Router();

router.get('/', publicCache, asyncHandler(async (_req, res) => {
  const items = await Category.find({ isVisible: true }).sort({ sortOrder: 1, 'name.en': 1 }).select('-__v').lean();
  res.json({ items });
}));

router.get('/:slug', publicCache, asyncHandler(async (req, res) => {
  const { slug } = req.params;
  if (!SLUG_RE.test(slug) || slug.length > 100) throw new AppError(404, 'Category not found', 'NOT_FOUND');
  const item = await Category.findOne({ slug, isVisible: true }).select('-__v').lean();
  if (!item) {
    const moved = await Category.findOne({ previousSlugs: slug, isVisible: true }).select('slug').lean();
    if (moved) return res.redirect(301, `/api/categories/${moved.slug}`);
    throw new AppError(404, 'Category not found', 'NOT_FOUND');
  }
  res.json({ item });
}));

export default router;
