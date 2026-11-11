import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateEnv } from '../../api/_lib/config/validate.js';

const good = {
  NODE_ENV: 'production', MONGODB_URI: 'mongodb+srv://u:p@cluster0.abcde.mongodb.net/babyfoodgallery?retryWrites=true',
  JWT_SECRET: 'f3a9c1d27be84a6f90d1c5e8b7a24d63f1e0c9b8a7d6e5f4a3b2c1d0e9f8a7b6',
  SITE_URL: 'https://babyfoodgallery.com', APP_URL: 'https://babyfoodgallery.com,https://www.babyfoodgallery.com',
  IMAGE_STORAGE: 'cloudinary', CLOUDINARY_CLOUD_NAME: 'demo', CLOUDINARY_API_KEY: '123', CLOUDINARY_API_SECRET: 'abc',
};
const names = (r) => r.errors.map((e) => e.name);

test('a complete production configuration is valid with no warnings', () => {
  const r = validateEnv(good);
  assert.equal(r.ok, true);
  assert.deepEqual(r.warnings, []);
  assert.equal(r.data.PORT, 5000);
});

test('production refuses to start without the essentials', () => {
  for (const key of ['MONGODB_URI', 'JWT_SECRET', 'SITE_URL']) {
    const { [key]: _omit, ...rest } = good;
    assert.ok(names(validateEnv(rest)).includes(key), key);
  }
});

test('placeholder or weak secrets are rejected in production', () => {
  assert.ok(names(validateEnv({ ...good, JWT_SECRET: 'changeme'.repeat(5) })).includes('JWT_SECRET'));
  assert.ok(names(validateEnv({ ...good, JWT_SECRET: 'a'.repeat(40) })).includes('JWT_SECRET')); // too repetitive
  assert.ok(names(validateEnv({ ...good, JWT_SECRET: 'short' })).includes('JWT_SECRET'));
  assert.ok(names(validateEnv({ ...good, JWT_SECRET: 'your-secret-here-please-replace-me-1234567' })).includes('JWT_SECRET'));
});

test('database URI must be real: right scheme, no <placeholders>', () => {
  assert.ok(names(validateEnv({ ...good, MONGODB_URI: 'postgres://x' })).includes('MONGODB_URI'));
  assert.ok(names(validateEnv({ ...good, MONGODB_URI: 'mongodb+srv://<db-user>:<db-password>@c.mongodb.net/x' })).includes('MONGODB_URI'));
});

test('site address must be https in production and listed in APP_URL (or every login would be refused)', () => {
  assert.ok(names(validateEnv({ ...good, SITE_URL: 'http://babyfoodgallery.com', APP_URL: 'http://babyfoodgallery.com' })).includes('SITE_URL'));
  assert.ok(names(validateEnv({ ...good, APP_URL: 'https://other.example' })).includes('APP_URL'));
  assert.ok(names(validateEnv({ ...good, SITE_URL: 'not a url' })).includes('SITE_URL'));
});

test('warnings: missing www, non-https origin, incomplete Cloudinary, address with a path', () => {
  const noWww = validateEnv({ ...good, APP_URL: 'https://babyfoodgallery.com' });
  assert.equal(noWww.ok, true);
  assert.ok(noWww.warnings.some((w) => w.name === 'APP_URL' && /www/.test(w.message)));
  const noCloud = validateEnv({ ...good, CLOUDINARY_API_SECRET: undefined });
  assert.equal(noCloud.ok, true);
  assert.ok(noCloud.warnings.some((w) => w.name === 'CLOUDINARY_*'));
  assert.ok(validateEnv({ ...good, SITE_URL: 'https://babyfoodgallery.com/shop', APP_URL: 'https://babyfoodgallery.com,https://www.babyfoodgallery.com' }).warnings.some((w) => /path/.test(w.message)));
});

test('local image storage is rejected in production', () => {
  assert.ok(names(validateEnv({ ...good, IMAGE_STORAGE: 'local' })).includes('IMAGE_STORAGE'));
  assert.ok(names(validateEnv({ ...good, IMAGE_STORAGE: 'ftp' })).includes('IMAGE_STORAGE'));
});

test('development is forgiving: only warnings for missing database and secret', () => {
  const r = validateEnv({});
  assert.equal(r.ok, true);
  assert.deepEqual(r.warnings.map((w) => w.name).sort(), ['JWT_SECRET', 'MONGODB_URI']);
  assert.equal(r.data.NODE_ENV, 'development');
  assert.equal(r.data.APP_URL, 'http://localhost:5173');
});

test('basic value checks apply everywhere', () => {
  assert.ok(names(validateEnv({ NODE_ENV: 'staging' })).includes('NODE_ENV'));
  assert.ok(names(validateEnv({ PORT: '99999' })).includes('PORT'));
  assert.ok(names(validateEnv({ PORT: 'abc' })).includes('PORT'));
  assert.ok(names(validateEnv({ META_PIXEL_ID: '12ab' })).includes('META_PIXEL_ID'));
  assert.ok(names(validateEnv({ CLOUDINARY_CLOUD_NAME: 'bad name!' })).includes('CLOUDINARY_CLOUD_NAME'));
  assert.ok(names(validateEnv({ JWT_SECRET: 'x'.repeat(10) })).includes('JWT_SECRET'));
  assert.equal(validateEnv({ PORT: '8080', NODE_ENV: 'test' }).data.PORT, 8080);
});

test('messages never contain the secret values themselves', () => {
  const secret = 'supersecretvalue-that-is-long-enough-1234567890';
  const r = validateEnv({ ...good, JWT_SECRET: secret, MONGODB_URI: 'mongodb+srv://user:pa55w0rd@x/<db>' });
  assert.equal(JSON.stringify([r.errors, r.warnings]).includes('pa55w0rd'), false);
  assert.equal(JSON.stringify([r.errors, r.warnings]).includes(secret), false);
});

import { pickImageStorage } from '../../api/_lib/config/validate.js';

test('image storage: Cloudinary is chosen automatically once its credentials are present (the dev crash scenario)', () => {
  const cloud = { CLOUDINARY_CLOUD_NAME: 'demo', CLOUDINARY_API_KEY: '1', CLOUDINARY_API_SECRET: 's' };
  assert.equal(pickImageStorage({ NODE_ENV: 'development', ...cloud }), 'cloudinary'); // .env copied from the example + credentials added
  assert.equal(pickImageStorage({ NODE_ENV: 'development' }), 'local');
  assert.equal(pickImageStorage({ NODE_ENV: 'production' }), 'cloudinary');
  assert.equal(pickImageStorage({ NODE_ENV: 'development', CLOUDINARY_CLOUD_NAME: 'demo' }), 'local'); // incomplete credentials
  assert.equal(pickImageStorage({ NODE_ENV: 'development', IMAGE_STORAGE: 'local', ...cloud }), 'local'); // an explicit choice always wins
  assert.equal(pickImageStorage({ NODE_ENV: 'development', IMAGE_STORAGE: 'cloudinary' }), 'cloudinary');
});

test('an empty IMAGE_STORAGE line (as in .env.example) counts as "not set"', () => {
  const r = validateEnv({ IMAGE_STORAGE: '', CLOUDINARY_CLOUD_NAME: 'demo', CLOUDINARY_API_KEY: '1', CLOUDINARY_API_SECRET: 's' });
  assert.equal(r.ok, true);
  assert.equal(r.data.IMAGE_STORAGE, undefined);
  assert.equal(pickImageStorage(r.data), 'cloudinary');
});
