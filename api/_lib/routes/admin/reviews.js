import { Router } from 'express';
import Review from '../../models/Review.js';
import { AppError, asyncHandler } from '../../utils/errors.js';
import { validate } from '../../middleware/validate.js';
import { idParam } from '../../schemas/catalog.js';
import { reviewList, reviewUpdate } from '../../schemas/admin.js';
import { recalcProductRating } from '../../services/reviews.js';

const router = Router();
const view = (r) => ({
  id: String(r._id), rating: r.rating, comment: r.comment ?? '', status: r.status, createdAt: r.createdAt,
  product: r.product ? { id: String(r.product._id), slug: r.product.slug, name: r.product.name } : null,
  customer: r.user ? { id: String(r.user._id), name: r.user.name, phone: r.user.phone } : null,
});

router.get('/', validate(reviewList, 'query'), asyncHandler(async (req, res) => {
  const { page, limit, status } = req.valid;
  const filter = status ? { status } : {};
  const [rows, total] = await Promise.all([
    Review.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).populate('product', 'slug name').populate('user', 'name phone').lean(),
    Review.countDocuments(filter),
  ]);
  res.json({ items: rows.map(view), page, limit, total, totalPages: Math.ceil(total / limit) });
}));

// Approve / reject / move back to pending. The product's shown rating is recalculated from approved reviews only.
router.patch('/:id', validate(idParam, 'params'), validate(reviewUpdate), asyncHandler(async (req, res) => {
  const r = await Review.findByIdAndUpdate(req.validParams.id, { status: req.valid.status }, { new: true }).populate('product', 'slug name').populate('user', 'name phone').lean();
  if (!r) throw new AppError(404, 'Review not found', 'NOT_FOUND');
  await recalcProductRating(r.product._id);
  res.json({ review: view(r) });
}));

router.delete('/:id', validate(idParam, 'params'), asyncHandler(async (req, res) => {
  const r = await Review.findByIdAndDelete(req.validParams.id).select('product');
  if (!r) throw new AppError(404, 'Review not found', 'NOT_FOUND');
  await recalcProductRating(r.product);
  res.json({ ok: true });
}));

export default router;
