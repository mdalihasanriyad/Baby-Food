import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DIST_DIR, PUBLIC_DIR, ROOT_DIR, UPLOAD_DIR } from '../../api/_lib/utils/paths.js';

// Regression: "TypeError: root path must be a string at serveStatic" happened because express.static() was given
// URL objects. express/serve-static rejects anything that is not a plain string.
const wouldServeStaticAccept = (root) => typeof root === 'string' && root.length > 0;

test('every exported location is a plain absolute string (never a URL object)', () => {
  for (const [name, value] of Object.entries({ ROOT_DIR, PUBLIC_DIR, UPLOAD_DIR, DIST_DIR })) {
    assert.equal(typeof value, 'string', `${name} must be a string`);
    assert.ok(path.isAbsolute(value), `${name} must be absolute`);
    assert.ok(wouldServeStaticAccept(value), `${name} must be acceptable to express.static`);
  }
});

test('the project root is detected correctly, whatever folder the process was started from', () => {
  assert.ok(fs.existsSync(path.join(ROOT_DIR, 'package.json')));
  assert.ok(fs.existsSync(path.join(ROOT_DIR, 'api', 'index.js')));
  assert.ok(fs.existsSync(path.join(ROOT_DIR, 'index.html')));
  assert.ok(fs.existsSync(PUBLIC_DIR), 'public/ must exist');
  assert.equal(UPLOAD_DIR, path.join(ROOT_DIR, 'public', 'uploads'));
  assert.equal(DIST_DIR, path.join(ROOT_DIR, 'dist'));
  const original = process.cwd();
  try { process.chdir(path.join(ROOT_DIR, 'tests')); assert.ok(fs.existsSync(path.join(ROOT_DIR, 'package.json'))); } finally { process.chdir(original); }
});

test('the app only ever gives express.static a string path from the paths module', () => {
  const sources = [];
  const walk = (dir) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p); else if (p.endsWith('.js')) sources.push(p); } };
  walk(path.join(ROOT_DIR, 'api'));
  let calls = 0;
  for (const file of sources) {
    const code = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''); // comments may mention express.static
    for (const m of code.matchAll(/express\.static\(\s*([^,)]*(?:\([^)]*\))?[^,)]*)/g)) {
      calls += 1;
      assert.match(m[1].trim(), /^(DIST_DIR|UPLOAD_DIR|PUBLIC_DIR|path\.join\()/, `${path.relative(ROOT_DIR, file)}: express.static(${m[1].trim()}) must use a string path`);
      assert.equal(/new URL/.test(m[1]), false);
    }
  }
  assert.ok(calls >= 3, 'expected the uploads and dist static mounts to be found');
});
