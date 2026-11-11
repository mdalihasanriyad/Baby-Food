import { ORDER_STATUSES } from '../models/constants.js';

/*
 * BUSINESS RULES (shown to admins in the dashboard too)
 * - Every figure is grouped by ORDER DATE (when the order was placed, Bangladesh time). An order placed on the 31st
 *   and delivered on the 2nd counts in the month it was placed, so the numbers always add up.
 * - Gross order value   = every order placed, including cancelled ones.
 * - Delivered sales     = orders with status "delivered" (includes the delivery charge paid by the customer).
 * - Open order value    = pending + confirmed + processing + shipped: not delivered, not cancelled, NOT revenue yet.
 * - Cancelled value     = orders cancelled (by customer or admin).
 *   Gross = Delivered + Open + Cancelled.
 * - Delivery charges / Discounts are shown for delivered orders only. Discounts are informational: they are already
 *   deducted from the item prices, so they are not subtracted again.
 * - Estimated profit    = sum of (price paid - cost price) x quantity over delivered items WHOSE COST PRICE IS SET.
 *   It excludes delivery charges and any cost of delivery, and is null when no delivered item has a cost price.
 * - Pending COD money   = delivered orders whose cash has not been marked collected yet.
 */
export const OPEN = ['pending', 'confirmed', 'processing', 'shipped'];

const empty = () => ({ count: 0, total: 0, subtotal: 0, deliveryFee: 0, discount: 0 });

// rows: [{ _id: status, count, total, subtotal, deliveryFee, discount }] from a $group on status
export function buildSummary(rows = []) {
  const by = Object.fromEntries(ORDER_STATUSES.map((s) => [s, empty()]));
  for (const r of rows) if (by[r._id]) by[r._id] = { count: r.count ?? 0, total: r.total ?? 0, subtotal: r.subtotal ?? 0, deliveryFee: r.deliveryFee ?? 0, discount: r.discount ?? 0 };
  const sum = (keys, f) => keys.reduce((n, k) => n + by[k][f], 0);
  return {
    byStatus: by,
    orders: {
      total: sum(ORDER_STATUSES, 'count'), pending: by.pending.count, confirmedProcessing: by.confirmed.count + by.processing.count,
      shipped: by.shipped.count, delivered: by.delivered.count, cancelled: by.cancelled.count, open: sum(OPEN, 'count'),
    },
    money: {
      grossOrderValue: sum(ORDER_STATUSES, 'total'),
      deliveredSales: by.delivered.total,
      deliveredProductRevenue: by.delivered.subtotal,
      deliveryCharges: by.delivered.deliveryFee,
      discountsGiven: by.delivered.discount,
      openOrderValue: sum(OPEN, 'total'),
      pendingValue: by.pending.total,
      cancelledValue: by.cancelled.total,
    },
  };
}

// profitRow: { profit, coveredRevenue } for delivered items that have a cost price (or undefined)
export function withProfit(summary, profitRow) {
  const covered = profitRow?.coveredRevenue ?? 0;
  const revenue = summary.money.deliveredProductRevenue;
  return {
    estimatedProfit: covered > 0 ? profitRow.profit : null,
    coveragePercent: revenue > 0 ? Math.round((covered / revenue) * 100) : 0,
  };
}
