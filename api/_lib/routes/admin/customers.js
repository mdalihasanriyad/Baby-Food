import { Router } from 'express';
import User from '../../models/User.js';
import Order from '../../models/Order.js';
import { AppError, asyncHandler } from '../../utils/errors.js';
import { validate } from '../../middleware/validate.js';
import { escapeRegex } from '../../utils/text.js';
import { idParam } from '../../schemas/catalog.js';
import { customerList, customerUpdate } from '../../schemas/admin.js';

const router = Router();

// Per-customer order stats, computed in one aggregation for the whole page of customers.
const statsFor = async (ids) => {
  const rows = await Order.aggregate([
    { $match: { user: { $in: ids } } },
    { $group: { _id: '$user', orders: { $sum: 1 }, deliveredOrders: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
      deliveredSpend: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, '$total', 0] } }, lastOrderAt: { $max: '$createdAt' } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r]));
};
const card = (u, st) => ({
  id: String(u._id), name: u.name, phone: u.phone, email: u.email ?? null, isActive: u.isActive, createdAt: u.createdAt,
  orders: st?.orders ?? 0, deliveredOrders: st?.deliveredOrders ?? 0, deliveredSpend: st?.deliveredSpend ?? 0, lastOrderAt: st?.lastOrderAt ?? null,
});

router.get('/', validate(customerList, 'query'), asyncHandler(async (req, res) => {
  const { page, limit, q } = req.valid;
  const filter = { role: 'customer' }; // admins never appear here
  if (q) { const rx = new RegExp(escapeRegex(q), 'i'); filter.$or = [{ name: rx }, { phone: rx }, { email: rx }]; }
  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).select('name phone email isActive createdAt').lean(),
    User.countDocuments(filter),
  ]);
  const stats = await statsFor(users.map((u) => u._id));
  res.json({ items: users.map((u) => card(u, stats.get(String(u._id)))), page, limit, total, totalPages: Math.ceil(total / limit) });
}));

router.get('/:id', validate(idParam, 'params'), asyncHandler(async (req, res) => {
  const u = await User.findOne({ _id: req.validParams.id, role: 'customer' }).select('name phone email isActive createdAt').lean();
  if (!u) throw new AppError(404, 'Customer not found', 'NOT_FOUND');
  const [stats, orders] = await Promise.all([
    statsFor([u._id]),
    Order.find({ user: u._id }).sort({ createdAt: -1 }).limit(20).select('trackingId status total createdAt paymentStatus').lean(),
  ]);
  res.json({ customer: card(u, stats.get(String(u._id))), recentOrders: orders });
}));

// Disable/enable an account. A disabled customer is signed out immediately (sessions are re-checked on every request).
router.patch('/:id', validate(idParam, 'params'), validate(customerUpdate), asyncHandler(async (req, res) => {
  const u = await User.findOneAndUpdate({ _id: req.validParams.id, role: 'customer' }, { $set: { isActive: req.valid.isActive } }, { new: true }).select('name phone email isActive createdAt').lean();
  if (!u) throw new AppError(404, 'Customer not found', 'NOT_FOUND');
  res.json({ customer: card(u, (await statsFor([u._id])).get(String(u._id))) });
}));

export default router;
