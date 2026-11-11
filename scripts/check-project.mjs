#!/usr/bin/env node
// Project consistency checks. Pure Node (no dependencies), safe to run anywhere:  npm run check
// Catches mistakes that otherwise show up only at deploy time: undeclared packages, client calls to routes that do not
// exist, admin routes without the admin guard, undocumented environment variables, committed secrets, broken deploy config.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { builtinModules } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const exists = (p) => existsSync(join(ROOT, p));
const SKIP = new Set(['node_modules', 'dist', '.git', 'uploads', '.vercel']);
const isCode = (f) => /\.(jsx?|mjs|cjs)$/.test(f);

function walk(dir, test = () => true, out = []) {
  if (!existsSync(join(ROOT, dir))) return out;
  for (const name of readdirSync(join(ROOT, dir))) {
    if (SKIP.has(name)) continue;
    const rel = dir === '.' ? name : `${dir}/${name}`;
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, test, out);
    else if (test(rel)) out.push(rel);
  }
  return out;
}

const checks = [];
const check = (name, fn) => checks.push({ name, fn });

// Text of the first argument of a call, starting just after its "(" (ends at the first top-level comma or the closing paren).
export function firstArg(line, from) {
  let depth = 0; let quote = null; let out = '';
  for (let i = from; i < line.length; i += 1) {
    const c = line[i];
    if (quote) { out += c; if (c === quote && line[i - 1] !== '\\') quote = null; continue; }
    if (c === "'" || c === '"' || c === '`') { quote = c; out += c; continue; }
    if (c === '(' || c === '[' || c === '{') depth += 1;
    if (c === ')' || c === ']' || c === '}') { if (depth === 0) break; depth -= 1; }
    if (c === ',' && depth === 0) break;
    out += c;
  }
  return out;
}

// ---- 1. every imported package is declared -----------------------------------------------------------------------
check('Dependencies: every imported package is declared in the single package.json', ({ fail, note }) => {
  const builtins = new Set(builtinModules);
  const pkg = JSON.parse(read('package.json'));
  const declared = new Set([...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})]);
  const used = new Set();
  const files = [...walk('api', isCode), ...walk('src', isCode), ...walk('scripts', isCode), ...walk('tests', isCode), ...['vite.config.js', 'tailwind.config.js', 'postcss.config.js', 'eslint.config.js']];
  for (const f of files) {
    const specs = [];
    for (const line of read(f).split('\n')) { // real import/export statements only, not words inside messages
      const a = line.match(/^\s*(?:import|export)\b[^'"]*?\bfrom\s*['"]([^'"]+)['"]/) ?? line.match(/^\s*import\s*['"]([^'"]+)['"]/);
      if (a) specs.push(a[1]);
      for (const d of line.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) specs.push(d[1]);
    }
    for (const spec of specs) {
      if (spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('node:') || builtins.has(spec)) continue;
      const name = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
      used.add(name);
      if (!declared.has(name)) fail(`${f}: imports "${name}" but package.json does not declare it`);
    }
  }
  for (const d of Object.keys(pkg.dependencies ?? {})) if (!used.has(d)) note(`package.json lists "${d}" under dependencies but nothing imports it`);
  note(`${used.size} packages in use, all declared`);
});

// ---- 2. client -> server API contract ------------------------------------------------------------------------------
function serverRoutes() {
  const table = [];
  const parseFile = (file, base) => {
    const src = read(file);
    const imports = new Map();
    for (const m of src.matchAll(/import\s+(\w+)\s+from\s+'(\.[^']+)'/g)) imports.set(m[1], join(dirname(file), m[2]).split(sep).join('/'));
    for (const m of src.matchAll(/\b(?:router|app)\.(get|post|put|patch|delete)\(\s*'([^']*)'/g)) table.push({ method: m[1].toUpperCase(), path: `${base}${m[2] === '/' ? '' : m[2]}` || '/' });
    for (const m of src.matchAll(/\b(?:router|app)\.use\(\s*'([^']+)'\s*,[^;]*?\b(\w+)\s*\)\s*;/g)) {
      const target = imports.get(m[2]);
      if (target && exists(target)) parseFile(target, `${base}${m[1]}`);
    }
  };
  parseFile('api/_lib/app.js', '');
  const seen = new Set();
  return table.filter((r) => { const k = `${r.method} ${r.path}`; if (seen.has(k)) return false; seen.add(k); return true; }); // the main router is reachable through two mounts
}
const toRegex = (p) => new RegExp(`^${p.replace(/:[A-Za-z]+/g, '[^/]+').replace(/\//g, '\\/')}$`);

check('API contract: every API call in the client matches a server route (path and method)', ({ fail, note }) => {
  const routes = serverRoutes().map((r) => ({ ...r, re: toRegex(r.path) }));
  note(`${routes.length} server routes found`);
  let calls = 0;
  for (const f of walk('src', isCode)) {
    const lines = read(f).split('\n');
    const admin = f.includes('/admin/');
    lines.forEach((line, i) => {
      for (const m of line.matchAll(/\b(api|useApi|call|fetch)\(/g)) {
        const arg = firstArg(line, m.index + m[0].length);
        const mexpr = lines.slice(i, i + 4).join(' ').match(/method:\s*([^,}]+)/)?.[1] ?? "'GET'";
        const methods = [...mexpr.matchAll(/'(GET|POST|PUT|PATCH|DELETE)'/g)].map((x) => x[1]);
        if (methods.length === 0) methods.push('GET');
        for (const lit of arg.matchAll(/[`'"](\/[^`'"\s]*)[`'"]/g)) {
          let p = lit[1].replace(/\$\{[^}]*\}/g, 'X').split('?')[0];
          if (/^\/(admin)?X?$/.test(p) || p.startsWith('/apiX')) continue; // helper plumbing such as `/api${path}`
          if (!p.startsWith('/api')) p = `${m[1] === 'call' && admin ? '/api/admin' : '/api'}${p}`;
          calls += 1;
          if (!routes.some((r) => r.re.test(p) && methods.includes(r.method))) fail(`${f}:${i + 1}: ${methods.join('/')} ${p} has no matching server route`);
        }
      }
    });
  }
  note(`${calls} client API calls checked`);
});

// ---- 3. authorization wiring ----------------------------------------------------------------------------------------
check('Authorization: admin routes sit behind requireAdmin; customer routes behind requireCustomer', ({ fail, note }) => {
  const admin = read('api/_lib/routes/admin.js');
  const guard = admin.indexOf('router.use(requireAdmin)');
  if (guard < 0) fail('api/_lib/routes/admin.js has no router.use(requireAdmin)');
  for (const m of admin.matchAll(/router\.(?:use|get|post|patch|put|delete)\(\s*'([^']+)'/g)) {
    if (m[1] !== '/auth' && m.index < guard) fail(`admin route "${m[1]}" is mounted BEFORE requireAdmin`);
  }
  if (!/router\.use\('\/admin', admin\)/.test(read('api/_lib/routes/index.js'))) fail('the admin router is not mounted at /admin');
  if (/router\.post\(\s*'\/(register|signup)/.test(read('api/_lib/routes/adminAuth.js'))) fail('there must be NO admin registration route');
  for (const f of ['orders', 'account', 'wishlist']) {
    const src = read(`api/_lib/routes/${f}.js`);
    const firstRoute = src.search(/router\.(get|post|put|patch|delete)\(/);
    const g = src.search(/router\.use\([^)]*requireCustomer/);
    if (g < 0 || g > firstRoute) fail(`routes/${f}.js must apply requireCustomer before its first route`);
  }
  const products = read('api/_lib/routes/products.js');
  for (const route of ["router.get('/:slug/review-eligibility'", "router.post('/:slug/reviews'"]) {
    if (!(products.split('\n').find((l) => l.includes(route)) ?? '').includes('requireCustomer')) fail(`products.js: ${route} must use requireCustomer`);
  }
  // sensitive fields may only be read by the files that legitimately need them
  const allow = { '+passwordHash': ['routes/account.js', 'utils/authenticate.js', 'models/User.js', 'scripts/createAdmin.js'], '+costPrice': ['routes/admin/', 'services/orders.js'], internalNotes: ['routes/admin/', 'services/orders.js', 'models/Order.js'] };
  for (const f of walk('api/_lib', isCode)) {
    const rel = f.replace(/^api\/_lib\//, '');
    const src = read(f);
    for (const [token, ok] of Object.entries(allow)) if (src.includes(token) && !ok.some((a) => rel.startsWith(a))) fail(`${f} references ${token}, which is only allowed in: ${ok.join(', ')}`);
  }
  note('guards, no admin signup route and sensitive-field usage verified');
});

// ---- 4. environment variables are documented -----------------------------------------------------------------------
check('Environment: every variable the code reads is documented in .env.example (and nothing unused is listed)', ({ fail, note }) => {
  const documented = new Set([...read('.env.example').matchAll(/^\s*#?\s*([A-Z][A-Z0-9_]+)=/gm)].map((m) => m[1]));
  const platform = new Set(['VERCEL', 'VERCEL_ENV']); // set by Vercel itself
  const oneOff = new Set(['ADMIN_NAME', 'ADMIN_PHONE', 'ADMIN_EMAIL', 'ADMIN_PASSWORD', 'MONGODB_URI_TEST', 'RATE_LIMIT_TEST_MODE', 'RATE_LIMIT_NAMESPACE']); // CLI/CI/test-only, documented in the README and PRODUCTION_CHECKLIST.md
  const used = new Set();
  for (const f of [...walk('api', isCode), ...walk('scripts', isCode)]) for (const m of read(f).matchAll(/process\.env\.([A-Z][A-Z0-9_]+)/g)) used.add(m[1]);
  for (const m of read('api/_lib/config/validate.js').matchAll(/\bstr\('([A-Z][A-Z0-9_]+)'\)/g)) used.add(m[1]);
  for (const v of used) if (!documented.has(v) && !platform.has(v) && !oneOff.has(v)) fail(`${v} is read by the code but missing from .env.example`);
  for (const v of documented) if (!used.has(v)) fail(`${v} is listed in .env.example but no code reads it`);
  const clientEnv = new Set();
  for (const f of walk('src', isCode)) for (const m of read(f).matchAll(/import\.meta\.env\.([A-Z_]+)/g)) clientEnv.add(m[1]);
  for (const v of clientEnv) if (!['MODE', 'DEV', 'PROD', 'BASE_URL', 'SSR'].includes(v)) fail(`client reads import.meta.env.${v}, but the browser app must not need configuration`);
  note(`${used.size} server variables checked`);
});

// ---- 5. secrets stay out of the repository and the client -----------------------------------------------------------
check('Secrets: no credentials in the repository, none referenced from client code, none logged', ({ fail }) => {
  if (exists('.env')) fail('a .env file exists in the project folder: it must never be committed or shared');
  if (!/^\.env$/m.test(read('.gitignore'))) fail('.gitignore does not ignore .env');
  for (const f of walk('.', (x) => /\.(jsx?|mjs|json|md|ya?ml|html|css|example|txt)$/.test(x) || x.endsWith('.env.example'))) {
    const src = read(f);
    // unit tests use obviously fake URIs on purpose (to prove passwords never leak into messages), so tests are exempt from this one rule
    if (!f.startsWith('tests/') && /mongodb(?:\+srv)?:\/\/[^:\s<>'"`/]+:[^@\s<>'"`]+@/.test(src)) fail(`${f}: contains a MongoDB URI with a real-looking password`);
    if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(src)) fail(`${f}: contains a private key`);
    if (f.includes('.env') && /^(JWT_SECRET|CLOUDINARY_API_SECRET)=\S+/m.test(src)) fail(`${f}: has a non-empty secret value`);
  }
  for (const f of [...walk('src', isCode), 'index.html']) if (/\b(JWT_SECRET|MONGODB_URI|CLOUDINARY_API_SECRET|CLOUDINARY_API_KEY|process\.env)\b/.test(read(f))) fail(`${f}: references a server-only value`);
  for (const f of walk('api', isCode)) {
    read(f).split('\n').forEach((line, i) => {
      for (const m of line.matchAll(/console\.(?:log|error|warn)\(/g)) {
        let depth = 0; let call = '';
        for (let k = m.index + m[0].length; k < line.length; k += 1) { // text inside this console call only
          if (line[k] === '(') depth += 1;
          if (line[k] === ')') { if (depth === 0) break; depth -= 1; }
          call += line[k];
        }
        const exprs = call.replace(/`([^`]*)`/g, (_, body) => [...body.matchAll(/\$\{([^}]*)\}/g)].map((x) => x[1]).join(' ')).replace(/'[^']*'|"[^"]*"/g, '');
        if (/\b(password|passwordHash|currentPassword|newPassword|token|secret|MONGODB_URI|JWT_SECRET)\b/i.test(exprs)) fail(`${f}:${i + 1}: logs a value that looks sensitive`);
      }
    });
  }
});

// ---- 6. deployment configuration ------------------------------------------------------------------------------------
check('Deployment: Vercel config, entry point, scripts, HTML shell marker', ({ fail, note }) => {
  const v = JSON.parse(read('vercel.json'));
  if (v.outputDirectory !== 'dist') fail('vercel.json outputDirectory must be dist');
  if (v.buildCommand !== 'npm run build') fail('vercel.json buildCommand must be "npm run build"');
  if (!v.functions?.['api/index.js']?.includeFiles?.includes('dist/shell.html')) fail('vercel.json must include dist/shell.html in the api/index.js function');
  const rewrites = (v.rewrites ?? []).map((r) => `${r.source} -> ${r.destination}`).join(' | ');
  if (!/\/api\/\(\.\*\) -> \/api/.test(rewrites)) fail('missing the /api/* rewrite');
  if (!/\(\?!api\/\|assets\/\)/.test(rewrites)) fail('missing the page rewrite that gives every route (refresh, deep links) the app shell');
  if (!/^export default /m.test(read('api/index.js'))) fail('api/index.js must default-export the Express app');
  const root = JSON.parse(read('package.json'));
  if (root.type !== 'module') fail('package.json must have "type": "module" (the API and scripts are ES modules)');
  if (root.workspaces) fail('package.json must not define workspaces: there is exactly one project');
  for (const x of ['dev', 'dev:api', 'build', 'start', 'lint', 'test', 'seed', 'check', 'create-admin', 'ensure-indexes', 'check-db', 'check-env', 'check-cloudinary']) if (!root.scripts?.[x]) fail(`package.json is missing the "${x}" script`);
  if (!root.engines?.node) fail('package.json should declare engines.node');
  if (!/postbuild/.test(root.scripts.build) || !/vite build/.test(root.scripts.build)) fail('the build script must run "vite build" and then scripts/postbuild.js');
  if (!read('index.html').includes('<!--seo-head-->')) fail('index.html lost the <!--seo-head--> marker the API fills in');
  if (!/outDir:\s*'dist'/.test(read('vite.config.js'))) fail('vite.config.js must build into dist');
  if (!/\.\/src\/\*\*/.test(read('tailwind.config.js'))) fail('tailwind.config.js must scan ./src/**');
  for (const ig of ['node_modules', 'dist', 'public/uploads']) if (!read('.gitignore').includes(ig)) fail(`.gitignore should contain ${ig}`);
  if (/^package-lock\.json$/m.test(read('.gitignore'))) fail('package-lock.json must be committed, not ignored');
  if (exists('dist')) {
    if (!exists('dist/shell.html')) fail('dist exists but has no shell.html (did the postbuild step run?)');
    if (exists('dist/index.html')) fail('dist/index.html must not exist: the CDN would serve it directly and skip the SEO layer');
  } else note('dist is not built here: build-output checks skipped');
});

// ---- 7. translations --------------------------------------------------------------------------------------------------
check('Translations: Bengali and English match, and every key the UI uses exists', async ({ fail, note }) => {
  const mod = await import(pathToFileURL(join(ROOT, 'src/i18n/translations.js')).href);
  const bn = new Set(Object.keys(mod.translations.bn)); const en = new Set(Object.keys(mod.translations.en));
  for (const k of bn) if (!en.has(k)) fail(`"${k}" is missing in English`);
  for (const k of en) if (!bn.has(k)) fail(`"${k}" is missing in Bengali`);
  const families = { 'order.s.': ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'], 'myrev.s.': ['pending', 'approved', 'rejected'], 'group.': ['baby', 'adult'], 'contact.v.': ['name', 'phone', 'message'] };
  for (const [p, l] of Object.entries(families)) for (const s of l) if (!en.has(p + s)) fail(`dynamic key "${p}${s}" is missing`);
  const prefixes = 'auth|rev|wish|product|shop|home|trust|nav|nf|contact|common|bc|group|sort|demo|hero|footer|about|lang|cart|checkout|order|orders|acct|profile|myrev|a11y|net|consent';
  const re = new RegExp(`['"\`]((?:${prefixes})\\.[A-Za-z0-9_.]+)['"\`]`, 'g');
  for (const f of walk('src', (x) => isCode(x) && !x.endsWith('translations.js'))) {
    for (const m of read(f).matchAll(re)) if (!en.has(m[1]) && !m[1].endsWith('.')) fail(`${f}: uses missing translation key "${m[1]}"`);
  }
  note(`${en.size} keys per language`);
});

// ---- 8. the single-root structure ------------------------------------------------------------------------------------
check('Structure: api, public, scripts, src, tests and the root config files; one package.json; one serverless function', ({ fail, note }) => {
  const required = ['api', 'public', 'scripts', 'src', 'tests', '.env.example', '.gitignore', 'DEPLOYMENT.md', 'IMPORTING.md', 'PRODUCTION_CHECKLIST.md', 'README.md',
    'index.html', 'package.json', 'postcss.config.js', 'tailwind.config.js', 'tsconfig.json', 'tsconfig.app.json', 'tsconfig.node.json', 'vercel.json', 'vite.config.js', 'eslint.config.js'];
  for (const r of required) if (!exists(r)) fail(`missing at the project root: ${r}`);
  const allowed = new Set([...required, 'package-lock.json', 'docs', 'node_modules', 'dist', '.git', '.github', '.vercel', '.env']);
  for (const name of readdirSync(ROOT)) if (!allowed.has(name)) fail(`unexpected item at the project root: ${name}`);
  for (const f of walk('.', (x) => x.endsWith('package.json'))) if (f !== 'package.json') fail(`${f}: there must be exactly one package.json`);
  if (exists('api')) for (const name of readdirSync(join(ROOT, 'api'))) if (name !== 'index.js' && !name.startsWith('_')) fail(`api/${name} would be deployed as an extra serverless function (only api/index.js should be)`);
  if (!exists('package-lock.json')) note('WARNING: package-lock.json does not exist yet. Run "npm install" once and commit the generated file (it pins exact versions).');
});

// ---- 9. nothing refers to the old two-folder layout ---------------------------------------------------------------------------
check('No leftovers: nothing refers to the old separate frontend/backend folders', ({ fail }) => {
  const old = /(^|[^A-Za-z0-9_.@-])(client|server)[\\/]/; // i.e. a path that starts with one of the two old folder names
  const files = walk('.', (x) => /\.(jsx?|mjs|cjs|json|md|ya?ml|html|css|txt)$/.test(x) || x.endsWith('.env.example') || x === '.gitignore');
  for (const f of files) {
    if (f === 'package-lock.json') continue;
    read(f).split('\n').forEach((line, i) => { if (old.test(line)) fail(`${f}:${i + 1}: ${line.trim().slice(0, 100)}`); });
  }
  for (const d of ['client', 'server']) if (exists(d)) fail(`the old "${d}" folder still exists`);
});

// ---- 10. static file roots are strings ----------------------------------------------------------------------------------------
check('Static files: express.static() only receives string paths from api/_lib/utils/paths.js', ({ fail, note }) => {
  let calls = 0;
  for (const f of walk('api', isCode)) {
    const code = read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''); // comments may mention it
    for (const m of code.matchAll(/express\.static\(/g)) {
      calls += 1;
      const arg = firstArg(code, m.index + m[0].length).trim();
      if (!/^(DIST_DIR|UPLOAD_DIR|PUBLIC_DIR|path\.join\()/.test(arg)) fail(`${f}: express.static(${arg.slice(0, 50)}) must be given a string path (express rejects URL objects with "root path must be a string")`);
    }
  }
  if (/export const \w+\s*=\s*new URL/.test(read('api/_lib/utils/paths.js'))) fail('api/_lib/utils/paths.js must export strings, not URL objects');
  note(`${calls} express.static calls checked`);
});

// ---- route inventory (npm run check -- --routes) ------------------------------------------------------------------
const PUBLIC_ADMIN = new Set(['POST /api/admin/auth/login', 'POST /api/admin/auth/logout']);
const CUSTOMER_ROUTES = [/^\/api\/(orders|account|wishlist)(\/|$)/, /^\/api\/auth\/me$/, /\/review-eligibility$/];
export function accessOf(method, path) {
  if (path.startsWith('/api/admin')) return PUBLIC_ADMIN.has(`${method} ${path}`) ? 'public' : 'admin';
  if (CUSTOMER_ROUTES.some((r) => r.test(path)) || (method === 'POST' && /^\/api\/products\/:slug\/reviews$/.test(path))) return 'customer';
  return 'public';
}

// ---- run and report -----------------------------------------------------------------------------------------------------
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--routes')) {
  const rows = serverRoutes().map((r) => ({ ...r, access: accessOf(r.method, r.path) }));
  rows.sort((a, b) => ['public', 'customer', 'admin'].indexOf(a.access) - ['public', 'customer', 'admin'].indexOf(b.access) || a.path.localeCompare(b.path));
  for (const acc of ['public', 'customer', 'admin']) {
    console.log(`\n### ${acc} (${rows.filter((r) => r.access === acc).length})\n`);
    for (const r of rows.filter((x) => x.access === acc)) console.log(`- \`${r.method} ${r.path}\``);
  }
} else if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let failed = 0;
  for (const c of checks) {
    const problems = []; const notes = [];
    try { await c.fn({ fail: (m) => problems.push(m), note: (m) => notes.push(m) }); } catch (e) { problems.push(`check crashed: ${e.message}`); }
    if (problems.length) failed += 1;
    console.log(`${problems.length ? '✘' : '✔'} ${c.name}`);
    for (const n of notes) console.log(`    · ${n}`);
    for (const p of problems) console.log(`    ✘ ${p}`);
  }
  console.log(failed ? `\n${failed} check(s) failed.` : `\nAll ${checks.length} checks passed.`);
  process.exit(failed ? 1 : 0);
}
