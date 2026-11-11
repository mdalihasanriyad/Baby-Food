import { Router } from 'express';
import Order from '../../models/Order.js';
import { AppError, asyncHandler } from '../../utils/errors.js';
import { validate } from '../../middleware/validate.js';
import { escapeRegex } from '../../utils/text.js';
import { matchFor, resolveRange } from '../../utils/dhaka.js';
import { adminOrderList, noteCreate, paymentChange, statusChange } from '../../schemas/admin.js';
import { adminOrderView, changeOrderStatus } from '../../services/orders.js';

const router = Router();
const TRACKING_RE = /^BFG-[A-F0-9]{16}$/;
const SORTS = { new: { createdAt: -1, _id: -1 }, old: { createdAt: 1, _id: 1 }, total_desc: { total: -1, _id: -1 }, total_asc: { total: 1, _id: 1 } };

const trackingParam = (req) => {
  const id = String(req.params.trackingId).toUpperCase();
  if (!TRACKING_RE.test(id)) throw new AppError(404, 'Order not found', 'NOT_FOUND');
  return id;
};
const load = async (trackingId) => {
  const o = await Order.findOne({ trackingId }).populate('user', 'name phone email').populate('statusHistory.by', 'name').populate('internalNotes.by', 'name');
  if (!o) throw new AppError(404, 'Order not found', 'NOT_FOUND');
  return o;
};

router.get('/', validate(adminOrderList, 'query'), asyncHandler(async (req, res) => {
  const { page, limit, q, status, paymentStatus, deliveryZone, customer, sort, preset, from, to } = req.valid;
  const filter = {};
  const range = resolveRange({ preset, from, to });
  if (preset !== 'all') Object.assign(filter, matchFor(range));
  if (status) filter.status = status;
  if (paymentStatus) filter.paymentStatus = paymentStatus;
  if (deliveryZone) filter.deliveryZone = deliveryZone;
  if (customer) filter.user = customer;
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ trackingId: q.toUpperCase() }, { 'customer.name': rx }, { 'customer.phone': rx }];
  }
  const [rows, total] = await Promise.all([
    Order.find(filter).sort(SORTS[sort]).skip((page - 1) * limit).limit(limit)
      .select('trackingId status paymentStatus paymentMethod deliveryZone createdAt total customer.name customer.phone customer.district items.quantity').lean(),
    Order.countDocuments(filter),
  ]);
  res.json({
    items: rows.map((o) => ({
      trackingId: o.trackingId, status: o.status, paymentStatus: o.paymentStatus, paymentMethod: o.paymentMethod, deliveryZone: o.deliveryZone,
      createdAt: o.createdAt, total: o.total, customer: o.customer, itemCount: o.items.reduce((n, i) => n + i.quantity, 0),
    })),
    page, limit, total, totalPages: Math.ceil(total / limit),
  });
}));

router.get('/:trackingId', asyncHandler(async (req, res) => {
  res.json({ order: adminOrderView(await load(trackingParam(req))) });
}));

router.patch('/:trackingId/status', validate(statusChange), asyncHandler(async (req, res) => {
  const trackingId = trackingParam(req);
  await changeOrderStatus({ trackingId, to: req.valid.status, actorId: req.user._id, note: req.valid.note });
  res.json({ order: adminOrderView(await load(trackingId)) });
}));

router.post('/:trackingId/notes', validate(noteCreate), asyncHandler(async (req, res) => {
  const trackingId = trackingParam(req);
  const r = await Order.updateOne({ trackingId }, { $push: { internalNotes: { text: req.valid.text, by: req.user._id, at: new Date() } } });
  if (r.matchedCount === 0) throw new AppError(404, 'Order not found', 'NOT_FOUND');
  res.status(201).json({ order: adminOrderView(await load(trackingId)) });
}));

// Cash-on-delivery collection tracking. Cash can only have been collected once the order is delivered.
router.post('/:trackingId/payment', validate(paymentChange), asyncHandler(async (req, res) => {
  const trackingId = trackingParam(req);
  const to = req.valid.paymentStatus;
  const now = new Date();
  const filter = to === 'collected' ? { trackingId, status: 'delivered', paymentStatus: 'unpaid' } : { trackingId, paymentStatus: 'collected' };
  const update = to === 'collected'
    ? { $set: { paymentStatus: 'collected', paymentCollectedAt: now } }
    : { $set: { paymentStatus: 'unpaid' }, $unset: { paymentCollectedAt: '' } };
  const r = await Order.updateOne(filter, { ...update, $push: { internalNotes: { text: `Payment marked ${to}`, by: req.user._id, at: now } } });
  if (r.matchedCount === 0) {
    if (!(await Order.exists({ trackingId }))) throw new AppError(404, 'Order not found', 'NOT_FOUND');
    throw new AppError(409, to === 'collected' ? 'Cash can only be marked collected for a delivered order that is still unpaid' : 'This order is not marked collected', 'PAYMENT_NOT_ALLOWED');
  }
  res.json({ order: adminOrderView(await load(trackingId)) });
}));

export default router;
