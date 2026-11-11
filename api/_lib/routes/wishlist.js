import { Router } from 'express';
import User from '../models/User.js';
import Product from '../models/Product.js';
import { AppError, asyncHandler } from '../utils/errors.js';
import { validate } from '../middleware/validate.js';
import { requireCustomer } from '../middleware/auth.js';
import { noStore } from '../middleware/cache.js';
import { LIST_FIELDS, PUBLIC_FILTER, slim } from '../services/catalog.js';
import { idParam } from '../schemas/catalog.js';

const router = Router();
router.use(noStore, requireCustomer); // private, per-user data: never cached, customers only
const MAX = 100;

const ids = async (userId) => (await User.findById(userId).select('+wishlist').lean())?.wishlist ?? [];

router.get('/ids', asyncHandler(async (req, res) => {
  res.json({ ids: (await ids(req.user._id)).map(String) });
}));

router.get('/', asyncHandler(async (req, res) => {
  const list = await ids(req.user._id);
  const items = await Product.find({ _id: { $in: list }, ...PUBLIC_FILTER }).select(LIST_FIELDS).populate('category', 'slug name group').lean();
  const rank = new Map(list.map((id, i) => [String(id), i]));
  items.sort((a, b) => rank.get(String(b._id)) - rank.get(String(a._id))); // most recently added first
  res.json({ items: slim(items) });
}));

router.put('/:id', validate(idParam, 'params'), asyncHandler(async (req, res) => {
  const { id } = req.validParams;
  if (!(await Product.exists({ _id: id, ...PUBLIC_FILTER }))) throw new AppError(404, 'Product not found', 'NOT_FOUND');
  const r = await User.updateOne({ _id: req.user._id, [`wishlist.${MAX - 1}`]: { $exists: false } }, { $addToSet: { wishlist: id } });
  if (r.matchedCount === 0) throw new AppError(409, 'Your wishlist is full', 'WISHLIST_FULL');
  res.json({ ok: true });
}));

router.delete('/:id', validate(idParam, 'params'), asyncHandler(async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $pull: { wishlist: req.validParams.id } });
  res.json({ ok: true });
}));

export default router;
