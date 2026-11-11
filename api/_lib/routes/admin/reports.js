import { Router } from 'express';
import Order from '../../models/Order.js';
import { asyncHandler } from '../../utils/errors.js';
import { validate } from '../../middleware/validate.js';
import { TZ, dhakaDateString, matchFor, resolveRange } from '../../utils/dhaka.js';
import { reportQuery } from '../../schemas/admin.js';
import { buildSummary, withProfit } from '../../services/metrics.js';
import { profitGroup, statusGroup } from './dashboard.js';

const router = Router();
const FORMATS = { day: '%Y-%m-%d', month: '%Y-%m', year: '%Y' };
const when = (status) => ({ $eq: ['$status', status] });
const sumIf = (cond, field) => ({ $sum: { $cond: [cond, field, 0] } });
const OPEN = ['pending', 'confirmed', 'processing', 'shipped'];

// Sales report by day / month / year with the same definitions as the dashboard. Paginated.
router.get('/sales', validate(reportQuery, 'query'), asyncHandler(async (req, res) => {
  const { groupBy, page, limit } = req.valid;
  const range = resolveRange(req.valid);
  const match = matchFor(range);
  const format = FORMATS[groupBy];

  const [grouped, profitRows, totalRows] = await Promise.all([
    Order.aggregate([
      { $match: match },
      { $group: {
        _id: { $dateToString: { format, date: '$createdAt', timezone: TZ } },
        orders: { $sum: 1 }, gross: { $sum: '$total' },
        deliveredOrders: sumIf(when('delivered'), 1), deliveredSales: sumIf(when('delivered'), '$total'),
        deliveredProductRevenue: sumIf(when('delivered'), '$subtotal'),
        deliveryCharges: sumIf(when('delivered'), '$deliveryFee'), discounts: sumIf(when('delivered'), '$discountTotal'),
        openOrders: sumIf({ $in: ['$status', OPEN] }, 1), openValue: sumIf({ $in: ['$status', OPEN] }, '$total'),
        cancelledOrders: sumIf(when('cancelled'), 1), cancelledValue: sumIf(when('cancelled'), '$total'),
      } },
      { $sort: { _id: -1 } },
      { $facet: { rows: [{ $skip: (page - 1) * limit }, { $limit: limit }], count: [{ $count: 'n' }] } },
    ]),
    profitGroup(match, format),
    statusGroup(match),
  ]);

  const profitBy = new Map(profitRows.map((p) => [p._id, p]));
  const rows = grouped[0].rows.map(({ _id, ...r }) => {
    const p = profitBy.get(_id);
    const covered = p?.coveredRevenue ?? 0;
    return {
      period: _id, ...r,
      estimatedProfit: covered > 0 ? p.profit : null,
      profitCoveragePercent: r.deliveredProductRevenue > 0 ? Math.round((covered / r.deliveredProductRevenue) * 100) : 0,
    };
  });
  const total = grouped[0].count[0]?.n ?? 0;
  const summary = buildSummary(totalRows);
  const allProfit = await profitGroup(match);
  res.json({
    range: { preset: range.preset, from: range.start ? dhakaDateString(range.start) : null, to: dhakaDateString(new Date(range.end.getTime() - 1)) },
    groupBy, rows, page, limit, total, totalPages: Math.ceil(total / limit),
    totals: { ...summary, profit: withProfit(summary, allProfit[0]) },
  });
}));

export default router;
