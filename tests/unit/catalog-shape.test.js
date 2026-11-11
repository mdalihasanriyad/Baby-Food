import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slim } from '../../api/_lib/utils/productShape.js';
import { publicCacheHeader } from '../../api/_lib/middleware/cache.js';

test('listing cards keep only the first image and never fail on products without images', () => {
  const input = [{ slug: 'a', images: [{ url: '1' }, { url: '2' }, { url: '3' }] }, { slug: 'b', images: [] }, { slug: 'c' }, { slug: 'd', images: [{ url: 'x' }] }];
  const out = slim(input);
  assert.deepEqual(out.map((p) => p.images.length), [1, 0, 0, 1]);
  assert.equal(out[0].images[0].url, '1');
  assert.equal(out[0].slug, 'a');
  assert.equal(input[0].images.length, 3, 'the original objects are not modified');
  assert.deepEqual(slim([]), []);
});

test('public data is cached in production but never while developing', () => {
  assert.equal(publicCacheHeader(false), 'no-store'); // a fresh `npm run seed` must show up on the next refresh
  assert.match(publicCacheHeader(true), /s-maxage=300/);
  assert.match(publicCacheHeader(true), /^public,/);
});
