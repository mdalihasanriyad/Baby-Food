import { Router } from 'express';
import { z } from 'zod';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import Review from '../models/Review.js';
import { AppError, asyncHandler } from '../utils/errors.js';
import { validate } from '../middleware/validate.js';
import { noStore, publicCache } from '../middleware/cache.js';
import { requireCustomer } from '../middleware/auth.js';
import { reviewLimiter } from '../middleware/rateLimits.js';
import { SLUG_RE } from '../models/constants.js';
import { escapeRegex } from '../utils/text.js';
import { LIST_FIELDS, PUBLIC_FILTER, categoryIdsForGroup, facets, slim } from '../services/catalog.js';
import { findEligibleOrder } from '../services/reviews.js';
import { reviewCreate, reviewList } from '../schemas/shop.js';

const router = Router();
const flag = z.enum(['1', 'true']).optional().transform((v) => Boolean(v));

const listQuery = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(12),
  q: z.string().trim().max(80).optional(),
  category: z.string().regex(SLUG_RE).max(100).optional(),
  group: z.enum(['baby', 'adult', 'other']).optional(),
  sort: z.enum(['new', 'price_asc', 'price_desc', 'popular']).default('new'),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  inStock: flag,
  discounted: flag,
  featured: flag,
});

const SORTS = {
  new: { createdAt: -1, _id: -1 },
  price_asc: { effectivePrice: 1, _id: 1 },
  price_desc: { effectivePrice: -1, _id: -1 },
  popular: { soldCount: -1, _id: -1 },
};

const notFound = () => new AppError(404, 'Product not found', 'NOT_FOUND');
async function publicProduct(slug, select) {
  if (!SLUG_RE.test(slug) || slug.length > 120) throw notFound();
  const p = await Product.findOne({ slug, ...PUBLIC_FILTER }).select(select).lean();
  if (!p) throw notFound();
  return p;
}
const firstName = (n) => String(n ?? '').trim().split(/\s+/)[0] || 'Customer'; // privacy: first name only

router.get('/', publicCache, validate(listQuery, 'query'), asyncHandler(async (req, res) => {
  const { page, limit, q, category, group, sort, minPrice, maxPrice, inStock, discounted, featured } = req.valid;
  const filter = { ...PUBLIC_FILTER };

  if (category) {
    const cat = await Category.findOne({ slug: category, isVisible: true }).select('_id').lean();
    if (!cat) return res.json({ items: [], page, limit, total: 0, totalPages: 0, facets: await facets() });
    filter.category = cat._id;
  } else if (group) {
    filter.category = { $in: await categoryIdsForGroup(group) };
  }
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i'); // escaped: user input never becomes a regex pattern
    filter.$or = [{ 'name.bn': rx }, { 'name.en': rx }, { brand: rx }];
  }
  if (minPrice != null || maxPrice != null) {
    filter.effectivePrice = {};
    if (minPrice != null) filter.effectivePrice.$gte = minPrice;
    if (maxPrice != null) filter.effectivePrice.$lte = maxPrice;
  }
  if (inStock) filter.stock = { $gt: 0 };
  if (discounted) filter.salePrice = { $ne: null };
  if (featured) filter.isFeatured = true;

  const [items, total, fct] = await Promise.all([
    Product.find(filter).sort(SORTS[sort]).skip((page - 1) * limit).limit(limit)
      .select(LIST_FIELDS).populate('category', 'slug name group').lean(),
    Product.countDocuments(filter),
    facets(),
  ]);
  res.json({ items: slim(items), page, limit, total, totalPages: Math.ceil(total / limit), facets: fct });
}));

router.get('/:slug', publicCache, asyncHandler(async (req, res) => {
  const { slug } = req.params;
  if (!SLUG_RE.test(slug) || slug.length > 120) throw notFound();
  const product = await Product.findOne({ slug, ...PUBLIC_FILTER }).populate('category', 'slug name group').select('-__v').lean();
  if (!product) {
    // Old link after a slug change: 301 to the current slug (fetch and crawlers follow it).
    const moved = await Product.findOne({ previousSlugs: slug, ...PUBLIC_FILTER }).select('slug').lean();
    if (moved) return res.redirect(301, `/api/products/${moved.slug}`);
    throw notFound();
  }
  res.json({ item: product });
}));

// Same category first, then topped up with other popular/new products.
router.get('/:slug/related', publicCache, asyncHandler(async (req, res) => {
  const p = await publicProduct(req.params.slug, '_id category');
  const find = (extra, n) => Product.find({ ...PUBLIC_FILTER, _id: { $nin: [p._id, ...(extra.ids ?? [])] }, ...(extra.category ? { category: p.category } : {}) })
    .sort({ soldCount: -1, createdAt: -1 }).limit(n).select(LIST_FIELDS).populate('category', 'slug name group').lean();
  const same = await find({ category: true }, 8);
  const more = same.length < 8 ? await find({ ids: same.map((x) => x._id) }, 8 - same.length) : [];
  res.json({ items: slim([...same, ...more]) });
}));

router.get('/:slug/reviews', publicCache, validate(reviewList, 'query'), asyncHandler(async (req, res) => {
  const p = await publicProduct(req.params.slug, '_id ratingAverage ratingCount');
  const { page, limit } = req.valid;
  const filter = { product: p._id, status: 'approved' }; // pending/rejected reviews are never public
  const [rows, total] = await Promise.all([
    Review.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('user', 'name').lean(),
    Review.countDocuments(filter),
  ]);
  res.json({
    items: rows.map((r) => ({ id: r._id, rating: r.rating, comment: r.comment ?? '', authorName: firstName(r.user?.name), createdAt: r.createdAt })),
    page, limit, total, totalPages: Math.ceil(total / limit), average: p.ratingAverage, count: p.ratingCount,
  });
}));

router.get('/:slug/review-eligibility', noStore, requireCustomer, asyncHandler(async (req, res) => {
  const p = await publicProduct(req.params.slug, '_id');
  if (await findEligibleOrder(req.user._id, p._id)) return res.json({ eligible: true });
  const reviewed = await Review.exists({ user: req.user._id, product: p._id });
  res.json({ eligible: false, reason: reviewed ? 'already_reviewed' : 'no_delivered_purchase' });
}));

router.post('/:slug/reviews', noStore, reviewLimiter, requireCustomer, validate(reviewCreate), asyncHandler(async (req, res) => {
  const p = await publicProduct(req.params.slug, '_id');
  const order = await findEligibleOrder(req.user._id, p._id);
  if (!order) throw new AppError(403, 'Only customers who received this product can review it', 'NOT_ELIGIBLE');
  // unique index (user, product, order) makes a double submit a 409
  await Review.create({ product: p._id, user: req.user._id, order: order._id, rating: req.valid.rating, comment: req.valid.comment || undefined, status: 'pending' });
  res.status(201).json({ ok: true, status: 'pending' });
}));

export default router;
