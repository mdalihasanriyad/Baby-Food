import { Router } from 'express';
import Order from '../models/Order.js';
import { AppError, asyncHandler } from '../utils/errors.js';
import { validate } from '../middleware/validate.js';
import { requireCustomer } from '../middleware/auth.js';
import { noStore } from '../middleware/cache.js';
import { cancelLimiter, orderLimiter } from '../middleware/rateLimits.js';
import { orderCreate } from '../schemas/orders.js';
import { cancelBody, orderListQuery } from '../schemas/account.js';
import { CUSTOMER_CANCELLABLE } from '../models/constants.js';
import { cancelOrder, createOrder, orderSummary, orderView } from '../services/orders.js';

const router = Router();
router.use(noStore, requireCustomer); // orders are private: customers only, never cached

const TRACKING_RE = /^BFG-[A-F0-9]{16}$/;
const notFound = () => new AppError(404, 'Order not found', 'NOT_FOUND'); // also used for other people's orders: leaks nothing

router.post('/', orderLimiter, validate(orderCreate), asyncHandler(async (req, res) => {
  const { order, duplicate } = await createOrder(req.user, req.valid);
  res.status(duplicate ? 200 : 201).json({ order: orderView(order), duplicate });
}));

// Order history: ALWAYS filtered by the logged-in user's id; there is no way to ask for someone else's.
router.get('/', validate(orderListQuery, 'query'), asyncHandler(async (req, res) => {
  const { page, limit, status } = req.valid;
  const filter = { user: req.user._id, ...(status ? { status } : {}) };
  const [rows, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit)
      .select('trackingId status createdAt total items.name items.image items.quantity').lean(),
    Order.countDocuments(filter),
  ]);
  res.json({ items: rows.map(orderSummary), page, limit, total, totalPages: Math.ceil(total / limit) });
}));

router.get('/:trackingId', asyncHandler(async (req, res) => {
  const { trackingId } = req.params;
  if (!TRACKING_RE.test(trackingId)) throw notFound();
  const order = await Order.findOne({ trackingId, user: req.user._id });
  if (!order) throw notFound();
  res.json({ order: orderView(order) });
}));

// Customers may cancel only while the order is still pending or confirmed. Stock goes back on the shelf.
router.post('/:trackingId/cancel', cancelLimiter, validate(cancelBody), asyncHandler(async (req, res) => {
  const { trackingId } = req.params;
  if (!TRACKING_RE.test(trackingId)) throw notFound();
  const own = await Order.exists({ trackingId, user: req.user._id });
  if (!own) throw notFound();
  const note = req.valid.reason ? `Cancelled by customer: ${req.valid.reason}` : 'Cancelled by customer';
  const order = await cancelOrder({ filter: { trackingId, user: req.user._id }, allowedFrom: CUSTOMER_CANCELLABLE, actorId: req.user._id, note });
  if (!order) throw new AppError(409, 'This order can no longer be cancelled online. Please contact us.', 'ORDER_NOT_CANCELLABLE');
  res.json({ order: orderView(order) });
}));

export default router;
