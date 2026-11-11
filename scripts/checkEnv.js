// Validates your configuration without starting the server.   npm run check-env
// To test a production setup on your own machine:              npm run check-env -- --production
import { validateEnv } from '../api/_lib/config/validate.js';

const asProduction = process.argv.includes('--production');
const r = validateEnv({ ...process.env, ...(asProduction ? { NODE_ENV: 'production' } : {}) });
console.log(`Checking configuration as: ${r.data.NODE_ENV}`);
for (const e of r.errors) console.log(`  ✘ ${e.name}: ${e.message}`);
for (const w of r.warnings) console.log(`  ! ${w.name}: ${w.message}`);
if (r.ok && r.warnings.length === 0) console.log('  ✔ all good');
console.log(r.ok ? '\nConfiguration is valid.' : '\nConfiguration has errors: the server would refuse to start.');
process.exit(r.ok ? 0 : 1);
