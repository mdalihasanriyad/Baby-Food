import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addMonths, dhakaDateString, dhakaDayStart, eachDay, matchFor, parseDhakaDate, resolveRange } from '../../api/_lib/utils/dhaka.js';
import { buildSummary, withProfit } from '../../api/_lib/services/metrics.js';

// 2026-03-15 23:30 UTC is already 2026-03-16 05:30 in Dhaka.
const now = new Date('2026-03-15T23:30:00Z');

test('Dhaka day boundaries are UTC+6', () => {
  assert.equal(dhakaDayStart(now).toISOString(), '2026-03-15T18:00:00.000Z'); // Dhaka midnight of the 16th
  assert.equal(dhakaDateString(now), '2026-03-16');
  assert.equal(dhakaDateString(new Date('2026-03-15T17:59:59Z')), '2026-03-15');
  assert.equal(dhakaDateString(new Date('2026-03-15T18:00:00Z')), '2026-03-16');
});

test('presets', () => {
  const today = resolveRange({ preset: 'today' }, now);
  assert.equal(today.start.toISOString(), '2026-03-15T18:00:00.000Z');
  assert.equal(today.end.toISOString(), '2026-03-16T18:00:00.000Z');
  const l7 = resolveRange({ preset: 'last7' }, now);
  assert.equal(dhakaDateString(l7.start), '2026-03-10'); // 7 calendar days including today
  assert.equal((l7.end - l7.start) / 86400000, 7);
  assert.equal((resolveRange({ preset: 'last30' }, now).end - resolveRange({ preset: 'last30' }, now).start) / 86400000, 30);
  const month = resolveRange({ preset: 'this_month' }, now);
  assert.equal(dhakaDateString(month.start), '2026-03-01');
  assert.equal(dhakaDateString(month.end), '2026-04-01');
  const prev = resolveRange({ preset: 'prev_month' }, now);
  assert.equal(dhakaDateString(prev.start), '2026-02-01');
  assert.equal(dhakaDateString(prev.end), '2026-03-01');
  assert.equal(resolveRange({ preset: 'all' }, now).start, null);
});

test('month maths across year boundaries and leap years', () => {
  const jan = new Date('2026-01-10T00:00:00Z');
  assert.equal(dhakaDateString(addMonths(jan, -1)), '2025-12-01');
  assert.equal(dhakaDateString(addMonths(new Date('2025-12-20T00:00:00Z'), 1)), '2026-01-01');
  const feb = resolveRange({ preset: 'this_month' }, new Date('2024-02-10T00:00:00Z'));
  assert.equal((feb.end - feb.start) / 86400000, 29);
});

test('custom range: inclusive end date, validation', () => {
  const r = resolveRange({ preset: 'custom', from: '2026-03-01', to: '2026-03-03' }, now);
  assert.equal((r.end - r.start) / 86400000, 3);
  assert.deepEqual(eachDay(r), ['2026-03-01', '2026-03-02', '2026-03-03']);
  assert.throws(() => resolveRange({ preset: 'custom', from: '2026-03-05', to: '2026-03-01' }, now), { name: 'BadRangeError' });
  assert.throws(() => resolveRange({ preset: 'custom', from: '2026-02-30', to: '2026-03-01' }, now), { name: 'BadRangeError' });
  assert.throws(() => resolveRange({ preset: 'custom' }, now), { name: 'BadRangeError' });
  assert.throws(() => resolveRange({ preset: 'custom', from: '2000-01-01', to: '2026-01-01' }, now), { name: 'BadRangeError' });
  assert.throws(() => resolveRange({ preset: 'nope' }, now), { name: 'BadRangeError' });
  assert.equal(parseDhakaDate('2026-13-01'), null);
});

test('matchFor uses an exclusive end and an optional start', () => {
  const m = matchFor(resolveRange({ preset: 'today' }, now));
  assert.ok(m.createdAt.$gte && m.createdAt.$lt);
  assert.equal(matchFor(resolveRange({ preset: 'all' }, now)).createdAt.$gte, undefined);
});

test('summary keeps delivered, open and cancelled money separate and reconciled', () => {
  const rows = [
    { _id: 'pending', count: 2, total: 1000, subtotal: 860, deliveryFee: 140, discount: 50 },
    { _id: 'shipped', count: 1, total: 570, subtotal: 500, deliveryFee: 70, discount: 0 },
    { _id: 'delivered', count: 3, total: 2400, subtotal: 2190, deliveryFee: 210, discount: 120 },
    { _id: 'cancelled', count: 1, total: 700, subtotal: 630, deliveryFee: 70, discount: 0 },
  ];
  const s = buildSummary(rows);
  assert.equal(s.orders.total, 7);
  assert.equal(s.orders.open, 3);
  assert.equal(s.orders.confirmedProcessing, 0);
  assert.equal(s.money.deliveredSales, 2400);
  assert.equal(s.money.openOrderValue, 1570);
  assert.equal(s.money.cancelledValue, 700);
  assert.equal(s.money.grossOrderValue, 4670);
  assert.equal(s.money.grossOrderValue, s.money.deliveredSales + s.money.openOrderValue + s.money.cancelledValue); // Gross = Delivered + Open + Cancelled
  assert.equal(s.money.deliveryCharges, 210);
  assert.equal(s.money.discountsGiven, 120);
  assert.equal(buildSummary([]).money.grossOrderValue, 0);
});

test('profit is null without costs and reports coverage when partial', () => {
  const s = buildSummary([{ _id: 'delivered', count: 1, total: 1070, subtotal: 1000, deliveryFee: 70, discount: 0 }]);
  assert.deepEqual(withProfit(s, undefined), { estimatedProfit: null, coveragePercent: 0 });
  assert.deepEqual(withProfit(s, { profit: 150, coveredRevenue: 400 }), { estimatedProfit: 150, coveragePercent: 40 });
});
