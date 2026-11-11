// Shared setup for integration tests. Needs a DISPOSABLE database (name must contain "test").
// Returns null (and the test file skips itself) when MONGODB_URI_TEST is not configured.
export async function setup() {
  const uri = process.env.MONGODB_URI_TEST;
  if (!uri || !/\/[^/?]*test[^/?]*(\?|$)/i.test(uri)) {
    console.log('SKIPPED: set MONGODB_URI_TEST to a database whose name contains "test".');
    return null;
  }
  process.env.MONGODB_URI = uri;
  process.env.NODE_ENV = 'test';
  process.env.IMAGE_STORAGE = 'local';
  process.env.JWT_SECRET ??= 'test-secret-'.padEnd(48, 'x');

  const { default: app } = await import('../../api/_lib/app.js');
  const { default: User } = await import('../../api/_lib/models/User.js');
  const { connectDB, disconnectDB } = await import('../../api/_lib/db/connect.js');
  const { hashPassword } = await import('../../api/_lib/utils/password.js');
  await connectDB();
  const { default: mongoose } = await import('mongoose');
  // Unique indexes (duplicate orders, phone numbers...) are what the code relies on: make sure they exist before testing.
  await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).init()));

  const tag = String(Date.now()).slice(-6);
  const password = 'Test1234pass';
  const adminPhone = `0161${tag}0`.slice(0, 11);
  const customerPhone = `0151${tag}0`.slice(0, 11);
  await User.create({ name: 'T Admin', phone: adminPhone, email: `a${tag}@example.test`, passwordHash: await hashPassword(password), role: 'admin' });
  await User.create({ name: 'T Customer', phone: customerPhone, passwordHash: await hashPassword(password), role: 'customer' });

  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const cookiesFrom = (res) => res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  const call = (path, { method = 'GET', body, cookie, headers = {}, raw, redirect } = {}) =>
    fetch(base + path, {
      method,
      redirect,
      headers: { ...(raw ? {} : { 'Content-Type': 'application/json' }), ...(cookie ? { cookie } : {}), ...headers },
      body: raw ?? (body ? JSON.stringify(body) : undefined),
    });

  const login = async (path, identifier) => cookiesFrom(await call(path, { method: 'POST', body: { identifier, password } }));
  const adminCookie = await login('/api/admin/auth/login', adminPhone);
  const customerCookie = await login('/api/auth/login', customerPhone);

  const cleanup = async () => {
    await User.deleteMany({ phone: { $in: [adminPhone, customerPhone] } });
    server.close();
    await disconnectDB();
  };
  return { call, adminCookie, customerCookie, tag, adminPhone, customerPhone, cleanup };
}
