// Runs the unit tests (always) and the database integration tests (when MONGODB_URI_TEST is set), and says plainly which ran.
//   npm test                 unit tests + integration tests if a test database is configured
//   npm run test:unit        unit tests only
//   npm run test:ci          fails if the integration tests cannot run (used by GitHub Actions)
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

try { process.loadEnvFile('.env'); } catch { /* no .env file: fine */ }
const unitOnly = process.argv.includes('--unit-only');
const requireDb = process.argv.includes('--require-db');
const list = (dir) => readdirSync(new URL(`../tests/${dir}`, import.meta.url)).filter((f) => f.endsWith('.test.js')).map((f) => `tests/${dir}${f}`);
const run = (files) => spawnSync(process.execPath, ['--test', '--env-file-if-exists=.env', ...files], { stdio: 'inherit' }).status ?? 1;
const bar = (t) => console.log(`\n=== ${t} ===`);

let failed = false;
bar('Unit tests (no database needed)');
if (run(list('unit/')) !== 0) failed = true;

if (!unitOnly) {
  const uri = process.env.MONGODB_URI_TEST;
  if (!uri || !/\/[^/?]*test[^/?]*(\?|$)/i.test(uri)) {
    bar('Database integration tests: SKIPPED');
    console.log('MONGODB_URI_TEST is not set to a database whose name contains "test", so the 8 integration test files did NOT run.');
    console.log('Auth, roles, orders, stock, reports and SEO page tests are only exercised when you set it (see the Testing section of README.md).');
    if (requireDb) { console.log('\n--require-db was given: treating this as a failure.'); failed = true; }
  } else {
    bar('Database integration tests');
    if (run(list('')) !== 0) failed = true;
  }
}
process.exit(failed ? 1 : 0);
