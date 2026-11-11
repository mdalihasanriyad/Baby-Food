import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allowedOrigins } from '../../api/_lib/utils/origins.js';

test('normalises APP_URL into clean browser origins', () => {
  assert.deepEqual(allowedOrigins('https://a.com/, https://www.a.com'), ['https://a.com', 'https://www.a.com']);
  assert.deepEqual(allowedOrigins('https://a.com/shop?x=1'), ['https://a.com']); // a browser Origin never has a path
  assert.deepEqual(allowedOrigins(' , ,'), []);
  assert.deepEqual(allowedOrigins(undefined), []);
});

test('invalid or non-web entries are ignored instead of crashing the app', () => {
  assert.deepEqual(allowedOrigins('not a url, ftp://x.com, https://ok.com'), ['https://ok.com']);
});

test('development accepts localhost and 127.0.0.1 interchangeably; production never adds aliases', () => {
  assert.deepEqual(allowedOrigins('http://localhost:5173', { development: true }).sort(), ['http://127.0.0.1:5173', 'http://localhost:5173']);
  assert.deepEqual(allowedOrigins('http://localhost:5173'), ['http://localhost:5173']);
  assert.deepEqual(allowedOrigins('https://babyfoodgallery.com', { development: true }), ['https://babyfoodgallery.com']); // real hosts untouched
  assert.deepEqual(allowedOrigins('http://127.0.0.1:5173', { development: true }).sort(), ['http://127.0.0.1:5173', 'http://localhost:5173']);
});

test('no duplicates', () => {
  assert.deepEqual(allowedOrigins('http://localhost:5173, http://localhost:5173/', { development: true }).length, 2);
});
