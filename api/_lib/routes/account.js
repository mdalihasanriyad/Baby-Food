import { Router } from 'express';
import User from '../models/User.js';
import Order from '../models/Order.js';
import Review from '../models/Review.js';
import Product from '../models/Product.js';
import { AppError, asyncHandler } from '../utils/errors.js';
import { validate } from '../middleware/validate.js';
import { requireCustomer } from '../middleware/auth.js';
import { noStore } from '../middleware/cache.js';
import { loginLimiter } from '../middleware/rateLimits.js';
import { passwordChange, profileUpdate } from '../schemas/account.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { issueSession, publicUser } from '../utils/session.js';
import { PUBLIC_FILTER } from '../services/catalog.js';

const router = Router();
router.use(noStore, requireCustomer);

const bad = (field, message) => new AppError(400, 'Invalid input', 'VALIDATION_ERROR', [{ field, message }]);

router.patch('/profile', loginLimiter, validate(profileUpdate), asyncHandler(async (req, res) => {
  const { name, phone, email, currentPassword } = req.valid;
  const user = await User.findById(req.user._id).select('+passwordHash');
  const emailChanged = (email ?? null) !== (user.email ?? null);

  // The phone number and email are login identifiers: changing them needs the current password.
  if (phone !== user.phone || emailChanged) {
    if (!currentPassword) throw bad('currentPassword', 'password_required');
    if (!(await verifyPassword(currentPassword, user.passwordHash))) throw bad('currentPassword', 'password_incorrect');
  }
  user.name = name;
  user.phone = phone;
  if (email) user.email = email; else user.set('email', undefined);
  await user.save(); // duplicate phone/email -> 409 from the central error handler
  res.json({ user: publicUser(user) });
}));

router.post('/password', loginLimiter, validate(passwordChange), asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.valid;
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!(await verifyPassword(currentPassword, user.passwordHash))) throw bad('currentPassword', 'password_incorrect');
  user.passwordHash = await hashPassword(newPassword);
  user.passwordChangedAt = new Date(); // every older session token stops working
  await user.save();
  issueSession(res, user, 'customer'); // keep THIS browser signed in with a fresh token
  res.json({ ok: true });
}));

// Reviews the customer wrote, plus purchases (delivered orders) they have not reviewed yet.
router.get('/reviews', asyncHandler(async (req, res) => {
  const [mine, delivered] = await Promise.all([
    Review.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(100).populate('product', 'slug name images').lean(),
    Order.find({ user: req.user._id, status: 'delivered' }).sort({ deliveredAt: -1, createdAt: -1 }).limit(50).select('trackingId items.product items.name items.image deliveredAt').lean(),
  ]);
  const reviewed = new Set(mine.map((r) => `${r.product?._id}:${r.order}`));
  const candidates = [];
  const seen = new Set();
  for (const o of delivered) {
    for (const i of o.items) {
      const key = `${i.product}:${o._id}`;
      if (!reviewed.has(key) && !seen.has(String(i.product))) { seen.add(String(i.product)); candidates.push({ productId: String(i.product), name: i.name, image: i.image ?? null, trackingId: o.trackingId }); }
    }
  }
  const live = await Product.find({ _id: { $in: candidates.map((c) => c.productId) }, ...PUBLIC_FILTER }).select('slug').lean();
  const slugs = new Map(live.map((p) => [String(p._id), p.slug]));
  res.json({
    reviews: mine.filter((r) => r.product).map((r) => ({
      id: r._id, rating: r.rating, comment: r.comment ?? '', status: r.status, createdAt: r.createdAt,
      product: { slug: r.product.slug, name: r.product.name, image: r.product.images?.[0]?.url ?? null },
    })),
    reviewable: candidates.filter((c) => slugs.has(c.productId)).slice(0, 20).map((c) => ({ ...c, slug: slugs.get(c.productId) })),
  });
}));

export default router;
