// The only test file that turns the rate limiters ON (everywhere else they are bypassed in NODE_ENV=test).
import { after, test } from 'node:test';
import assert from 'node:assert/strict';

const ns = `t10-${Date.now()}-`; // fresh counters on every run
process.env.RATE_LIMIT_TEST_MODE = 'on';
process.env.RATE_LIMIT_NAMESPACE = ns;

const { setup } = await import('./helpers/setup.js');
const ctx = await setup();
if (!ctx) process.exit(0);
const { call, customerPhone, cleanup } = ctx;
const { RateLimit } = await import('../api/_lib/middleware/mongoRateLimitStore.js');

after(async () => {
  await RateLimit.deleteMany({ _id: new RegExp(`^${ns}`) });
  await cleanup();
});

test('successful logins are never counted against the limit', async () => {
  for (let i = 0; i < 12; i += 1) {
    const r = await call('/api/auth/login', { method: 'POST', body: { identifier: customerPhone, password: 'Test1234pass' } });
    assert.equal(r.status, 200, `login ${i + 1}`);
  }
});

test('after 10 FAILED logins the 11th is refused with 429, even with the right password', async () => {
  for (let i = 0; i < 10; i += 1) {
    const r = await call('/api/auth/login', { method: 'POST', body: { identifier: customerPhone, password: 'Wrong1234pass' } });
    assert.equal(r.status, 401, `attempt ${i + 1}`);
  }
  const blocked = await call('/api/auth/login', { method: 'POST', body: { identifier: customerPhone, password: 'Test1234pass' } });
  assert.equal(blocked.status, 429);
  assert.equal((await blocked.json()).error.code, 'RATE_LIMITED');
  assert.ok(blocked.headers.get('ratelimit-limit') || blocked.headers.get('ratelimit-policy')); // standard rate-limit headers are sent
});

test('the contact form allows 5 messages per hour per network, then 429', async () => {
  const body = { name: 'Rate Test', phone: '01711111111', message: 'This is a rate limit test message.' };
  for (let i = 0; i < 5; i += 1) assert.equal((await call('/api/contact', { method: 'POST', body })).status, 201, `message ${i + 1}`);
  assert.equal((await call('/api/contact', { method: 'POST', body })).status, 429);
});

test('limits are shared state in the database, not per process', async () => {
  const docs = await RateLimit.find({ _id: new RegExp(`^${ns}`) }).lean();
  assert.ok(docs.some((d) => d._id.startsWith(`${ns}login:`) && d.count >= 10));
  assert.ok(docs.every((d) => d.resetAt > new Date())); // each counter has an expiry
});
