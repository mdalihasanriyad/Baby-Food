import { Router } from 'express';
import Order from '../../models/Order.js';
import Product from '../../models/Product.js';
import StoreSettings from '../../models/StoreSettings.js';
import { asyncHandler } from '../../utils/errors.js';
import { validate } from '../../middleware/validate.js';
import { TZ, dhakaDateString, eachDay, matchFor, rangeDays, resolveRange } from '../../utils/dhaka.js';
import { rangeQuery } from '../../schemas/admin.js';
import { buildSummary, withProfit } from '../../services/metrics.js';

const router = Router();

export const statusGroup = (match) => Order.aggregate([
  { $match: match },
  { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$total' }, subtotal: { $sum: '$subtotal' }, deliveryFee: { $sum: '$deliveryFee' }, discount: { $sum: '$discountTotal' } } },
]);

// Profit only from delivered items that have a cost price (see the rules in services/metrics.js)
export const profitGroup = (match, byFormat) => Order.aggregate([
  { $match: { ...match, status: 'delivered' } },
  { $unwind: '$items' },
  { $match: { 'items.costPrice': { $type: 'number' } } },
  { $group: {
    _id: byFormat ? { $dateToString: { format: byFormat, date: '$createdAt', timezone: TZ } } : null,
    profit: { $sum: { $multiply: [{ $subtract: ['$items.unitPrice', '$items.costPrice'] }, '$items.quantity'] } },
    coveredRevenue: { $sum: '$items.lineTotal' },
  } },
]);

router.get('/', validate(rangeQuery, 'query'), asyncHandler(async (req, res) => {
  const range = resolveRange(req.valid); // throws BadRangeError -> 400
  const match = matchFor(range);
  const dayLevel = rangeDays(range) <= 62;
  const fmt = dayLevel ? '%Y-%m-%d' : '%Y-%m';
  const settings = await StoreSettings.getSingleton();

  const [statusRows, profitRows, trendRows, best, low, recent] = await Promise.all([
    statusGroup(match),
    profitGroup(match),
    Order.aggregate([
      { $match: match },
      { $group: { _id: { $dateToString: { format: fmt, date: '$createdAt', timezone: TZ } }, orders: { $sum: 1 }, gross: { $sum: '$total' },
        deliveredSales: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, '$total', 0] } } } },
      { $sort: { _id: 1 } },
    ]),
    // Bestsellers = units in non-cancelled orders placed in the range
    Order.aggregate([
      { $match: { ...match, status: { $ne: 'cancelled' } } },
      { $unwind: '$items' },
      { $group: { _id: '$items.product', name: { $first: '$items.name' }, sku: { $first: '$items.sku' }, quantity: { $sum: '$items.quantity' }, revenue: { $sum: '$items.lineTotal' } } },
      { $sort: { quantity: -1, _id: 1 } }, { $limit: 5 },
    ]),
    Product.find({ status: 'active', stock: { $lte: settings.lowStockThreshold } }).sort({ stock: 1, _id: 1 }).limit(10).select('name sku stock isPublished slug').lean(),
    Order.find().sort({ createdAt: -1 }).limit(10).select('trackingId status total createdAt customer.name').lean(),
  ]);

  const summary = buildSummary(statusRows);
  let trend = trendRows.map((r) => ({ period: r._id, orders: r.orders, gross: r.gross, deliveredSales: r.deliveredSales }));
  if (dayLevel) { // show days with no orders as zero instead of leaving gaps
    const by = new Map(trend.map((t) => [t.period, t]));
    trend = eachDay(range).map((d) => by.get(d) ?? { period: d, orders: 0, gross: 0, deliveredSales: 0 });
  }
  res.json({
    range: { preset: range.preset, from: range.start ? dhakaDateString(range.start) : null, to: dhakaDateString(new Date(range.end.getTime() - 1)) },
    summary, profit: withProfit(summary, profitRows[0]),
    trend: { granularity: dayLevel ? 'day' : 'month', points: trend },
    bestsellers: best.map((b) => ({ productId: String(b._id), name: b.name, sku: b.sku, quantity: b.quantity, revenue: b.revenue })),
    lowStock: low, lowStockThreshold: settings.lowStockThreshold,
    recentOrders: recent.map((o) => ({ trackingId: o.trackingId, status: o.status, total: o.total, createdAt: o.createdAt, customerName: o.customer?.name })),
  });
}));

export default router;
