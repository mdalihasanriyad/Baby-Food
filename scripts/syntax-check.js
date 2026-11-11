// Cross-platform syntax check for every API, script and test file (works on Windows too).
import { readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const base = join(dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;
let count = 0;
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.js')) {
      count += 1;
      const r = spawnSync(process.execPath, ['--check', p], { encoding: 'utf8' });
      if (r.status !== 0) { failed += 1; console.error(r.stderr); }
    }
  }
};
for (const d of ['api', 'scripts', 'tests']) walk(join(base, d));
for (const f of ['vite.config.js', 'tailwind.config.js', 'postcss.config.js', 'eslint.config.js']) { // root configuration files
  count += 1;
  const r = spawnSync(process.execPath, ['--check', join(base, f)], { encoding: 'utf8' });
  if (r.status !== 0) { failed += 1; console.error(r.stderr); }
}
console.log(`${count} files checked, ${failed} failed`);
process.exit(failed ? 1 : 0);
