// Integration tests for auth + role separation. They need a REAL but DISPOSABLE database:
//   MONGODB_URI_TEST=mongodb+srv://.../babyfoodgallery_test?...   npm test
// The suite refuses to run unless the database name contains "test", and it only deletes users it created.
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';

const uri = process.env.MONGODB_URI_TEST;
if (!uri || !/\/[^/?]*test[^/?]*(\?|$)/i.test(uri)) {
  console.log('SKIPPED: set MONGODB_URI_TEST to a database whose name contains "test".');
  process.exit(0);
}
process.env.MONGODB_URI = uri;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ??= 'test-secret-'.padEnd(48, 'x');

const { default: app } = await import('../api/_lib/app.js');
const { default: User } = await import('../api/_lib/models/User.js');
const { connectDB, disconnectDB } = await import('../api/_lib/db/connect.js');
const { hashPassword } = await import('../api/_lib/utils/password.js');

const tag = String(Date.now()).slice(-7);
const customerPhone = `0171${tag}`;
const adminPhone = `0181${tag}`;
const PASSWORD = 'Test1234pass';
let server; let base;

const cookiesFrom = (res) => res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
const call = (path, { method = 'GET', body, cookie } = {}) =>
  fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });

before(async () => {
  await connectDB();
  await User.create({ name: 'Test Admin', phone: adminPhone, email: `admin${tag}@example.test`, passwordHash: await hashPassword(PASSWORD), role: 'admin' });
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await User.deleteMany({ phone: { $in: [customerPhone, adminPhone] } });
  server?.close();
  await disconnectDB();
});

test('register creates a customer and ignores a role in the request body', async () => {
  const res = await call('/api/auth/register', { method: 'POST', body: { name: 'Test Customer', phone: customerPhone, password: PASSWORD, confirmPassword: PASSWORD, role: 'admin' } });
  assert.equal(res.status, 201);
  assert.equal((await res.json()).user.role, 'customer');
});

test('register rejects weak passwords and mismatched confirmation', async () => {
  const weak = await call('/api/auth/register', { method: 'POST', body: { name: 'X Y', phone: `0191${tag}`, password: 'short', confirmPassword: 'short' } });
  assert.equal(weak.status, 400);
  const mismatch = await call('/api/auth/register', { method: 'POST', body: { name: 'X Y', phone: `0191${tag}`, password: PASSWORD, confirmPassword: 'Other1234pass' } });
  assert.equal(mismatch.status, 400);
});

test('customer login works, /me needs the cookie, wrong password is generic', async () => {
  const ok = await call('/api/auth/login', { method: 'POST', body: { identifier: customerPhone, password: PASSWORD } });
  assert.equal(ok.status, 200);
  const cookie = cookiesFrom(ok);
  assert.equal((await call('/api/auth/me', { cookie })).status, 200);
  assert.equal((await call('/api/auth/me')).status, 401);
  const bad = await call('/api/auth/login', { method: 'POST', body: { identifier: customerPhone, password: 'Wrong1234pass' } });
  const none = await call('/api/auth/login', { method: 'POST', body: { identifier: '01300000000', password: 'Wrong1234pass' } });
  assert.equal(bad.status, 401);
  assert.deepEqual((await bad.json()).error, (await none.json()).error);
});

test('a customer can NOT use admin APIs, and cannot log in as admin', async () => {
  const login = await call('/api/auth/login', { method: 'POST', body: { identifier: customerPhone, password: PASSWORD } });
  const cookie = cookiesFrom(login);
  assert.equal((await call('/api/admin/ping', { cookie })).status, 401);
  assert.equal((await call('/api/admin/auth/me', { cookie })).status, 401);
  const asAdmin = await call('/api/admin/auth/login', { method: 'POST', body: { identifier: customerPhone, password: PASSWORD } });
  assert.equal(asAdmin.status, 401);
  assert.equal((await call('/api/admin/ping')).status, 401);
});

test('admin logs in via the admin route only and can reach admin APIs', async () => {
  const viaCustomer = await call('/api/auth/login', { method: 'POST', body: { identifier: adminPhone, password: PASSWORD } });
  assert.equal(viaCustomer.status, 401);
  const res = await call('/api/admin/auth/login', { method: 'POST', body: { identifier: adminPhone, password: PASSWORD } });
  assert.equal(res.status, 200);
  const cookie = cookiesFrom(res);
  assert.equal((await call('/api/admin/ping', { cookie })).status, 200);
  const logout = await call('/api/admin/auth/logout', { method: 'POST', cookie });
  assert.equal(logout.status, 200);
});

test('cross-origin state-changing requests are rejected', async () => {
  const res = await fetch(`${base}/api/auth/logout`, { method: 'POST', headers: { Origin: 'https://evil.example' } });
  assert.equal(res.status, 403);
});

test('NoSQL operator objects in login input are rejected', async () => {
  const res = await call('/api/auth/login', { method: 'POST', body: { identifier: { $ne: '' }, password: { $ne: '' } } });
  assert.equal(res.status, 400);
});
