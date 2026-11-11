import { test } from 'node:test';
import assert from 'node:assert/strict';

// mongoose is not needed for these tests: a tiny in-memory stand-in implements the two query shapes the store uses.
// (The store file imports mongoose, so we load it through a stub registered below.)
import { register } from 'node:module';
const stub = `
export default { Schema: class { index() {} }, models: {}, model: () => ({}) };
`;
register(`data:text/javascript,${encodeURIComponent(`
export async function resolve(spec, ctx, next) { return spec === 'mongoose' ? { url: 'data:text/javascript,${encodeURIComponent(stub)}', shortCircuit: true } : next(spec, ctx); }
`)}`);
const { MongoRateLimitStore } = await import('../../api/_lib/middleware/mongoRateLimitStore.js');

class FakeModel {
  constructor() { this.docs = new Map(); this.failNextUpsertWith = null; this.broken = false; }
  findOneAndUpdate(filter, update, opts) {
    const run = async () => {
      if (this.broken) throw Object.assign(new Error('db down'), { name: 'MongoNetworkError' });
      const cur = this.docs.get(filter._id);
      const live = cur && (!filter.resetAt || cur.resetAt > filter.resetAt.$gt);
      if (update.$inc) { if (!live) return null; cur.count += update.$inc.count; return { ...cur }; }
      if (opts.upsert) {
        if (this.failNextUpsertWith) { const e = this.failNextUpsertWith; this.failNextUpsertWith = null; this.docs.set(filter._id, { _id: filter._id, count: 1, resetAt: update.$set.resetAt }); throw e; }
        const doc = { _id: filter._id, ...update.$set }; this.docs.set(filter._id, doc); return { ...doc };
      }
      return null;
    };
    return { lean: run };
  }
  async updateOne(filter, update) { const d = this.docs.get(filter._id); if (d && d.count > filter.count.$gt) d.count += update.$inc.count; }
  async deleteOne(filter) { this.docs.delete(filter._id); }
}

const setup = (prefix = 'login:') => {
  const model = new FakeModel(); let t = 1_000_000;
  const store = new MongoRateLimitStore({ prefix, model, now: () => new Date(t) });
  store.init({ windowMs: 60_000 });
  return { model, store, advance: (ms) => { t += ms; } };
};

test('counts hits inside a window', async () => {
  const { store } = setup();
  assert.equal((await store.increment('1.2.3.4')).totalHits, 1);
  assert.equal((await store.increment('1.2.3.4')).totalHits, 2);
  assert.equal((await store.increment('1.2.3.4')).totalHits, 3);
  assert.equal((await store.increment('5.6.7.8')).totalHits, 1); // another client has its own counter
});

test('a new window starts after the old one expires', async () => {
  const { store, advance } = setup();
  await store.increment('k'); await store.increment('k');
  advance(59_000);
  assert.equal((await store.increment('k')).totalHits, 3);
  advance(61_000);
  const r = await store.increment('k');
  assert.equal(r.totalHits, 1);
  assert.ok(r.resetTime.getTime() > 1_000_000 + 61_000);
});

test('reports when the window resets', async () => {
  const { store } = setup();
  const r = await store.increment('k');
  assert.equal(r.resetTime.getTime(), 1_000_000 + 60_000);
});

test('decrement (successful requests) never goes below zero; resetKey clears', async () => {
  const { store } = setup();
  await store.increment('k'); await store.increment('k');
  await store.decrement('k');
  assert.equal((await store.increment('k')).totalHits, 2);
  await store.decrement('k'); await store.decrement('k'); await store.decrement('k'); await store.decrement('k');
  assert.equal((await store.increment('k')).totalHits, 1);
  await store.resetKey('k');
  assert.equal((await store.increment('k')).totalHits, 1);
});

test('two first requests racing to create the counter are both counted', async () => {
  const { store, model } = setup();
  model.failNextUpsertWith = Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
  const r = await store.increment('k'); // the "other" request created the doc (count 1); this one then increments it
  assert.equal(r.totalHits, 2);
});

test('different limiters never share counters (prefix)', async () => {
  const a = setup('login:'); const b = new MongoRateLimitStore({ prefix: 'contact:', model: a.model, now: () => new Date(1_000_000) });
  b.init({ windowMs: 60_000 });
  await a.store.increment('ip'); await a.store.increment('ip');
  assert.equal((await b.increment('ip')).totalHits, 1);
});

test('fails OPEN when the database is down: the request is allowed, nothing throws', async () => {
  const { store, model } = setup();
  model.broken = true;
  const orig = console.error; let logged = '';
  console.error = (m) => { logged += m; };
  try {
    const r = await store.increment('k');
    assert.equal(r.totalHits, 1);
    assert.ok(logged.includes('MongoNetworkError'));
    assert.equal(logged.includes('db down'), false); // only the error name is logged
  } finally { console.error = orig; }
  await store.decrement('k'); await store.resetKey('k'); // best-effort calls also never throw
});
