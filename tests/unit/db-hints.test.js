import { test } from 'node:test';
import assert from 'node:assert/strict';
import { databaseHints } from '../../api/_lib/db/hints.js';

const base = { categories: 8, products: 10, published: 10, demo: 0, customers: 1, admins: 1, categoriesWithoutSection: 0 };

test('a healthy database produces no hints', () => {
  assert.deepEqual(databaseHints(base), []);
});

test('an empty database points to the seed script (a connection alone does not mean there is data)', () => {
  const h = databaseHints({ ...base, categories: 0, products: 0, published: 0 });
  assert.ok(h.some((x) => x.includes('npm run seed') && /no catalog/.test(x)));
  assert.ok(databaseHints({ ...base, products: 0, published: 0 }).some((x) => x.includes('npm run seed')));
});

test('products that exist but are not published are explained', () => {
  const h = databaseHints({ ...base, published: 0 });
  assert.ok(h.some((x) => /none is published/.test(x)));
  assert.equal(h.some((x) => /no catalog/.test(x)), false);
});

test('missing admin, categories without a shop section, and all-demo data are each reported', () => {
  assert.ok(databaseHints({ ...base, admins: 0 }).some((x) => x.includes('npm run create-admin')));
  assert.ok(databaseHints({ ...base, categoriesWithoutSection: 3 }).some((x) => /3 categories have no "Shop section"/.test(x)));
  assert.ok(databaseHints({ ...base, categoriesWithoutSection: 1 }).some((x) => /1 category has no "Shop section"/.test(x)));
  assert.ok(databaseHints({ ...base, demo: 10 }).some((x) => /sample \(demo\)/.test(x)));
});
