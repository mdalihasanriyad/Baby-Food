// Creates an admin account. Run on a trusted machine: npm run create-admin
// Interactive by default (password is typed hidden, never stored in env files or shell history).
// Non-interactive (CI): set ADMIN_NAME, ADMIN_PHONE, ADMIN_EMAIL, ADMIN_PASSWORD for that one command only.
import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import User from '../api/_lib/models/User.js';
import { connectDB, disconnectDB } from '../api/_lib/db/connect.js';
import { hashPassword } from '../api/_lib/utils/password.js';
import { z } from 'zod';
import { emailSchema, passwordSchema, phoneSchema } from '../api/_lib/schemas/auth.js';

function ask(question, hidden = false) {
  return new Promise((resolve) => {
    let muted = false;
    const out = new Writable({ write(chunk, enc, cb) { if (!muted) process.stdout.write(chunk, enc); cb(); } });
    const rl = createInterface({ input: process.stdin, output: out, terminal: true });
    rl.question(question, (answer) => { rl.close(); if (hidden) process.stdout.write('\n'); resolve(answer); });
    muted = hidden; // the prompt is already printed; mute what the user types
  });
}

const input = {
  name: process.env.ADMIN_NAME ?? (await ask('Admin name: ')),
  phone: process.env.ADMIN_PHONE ?? (await ask('Admin mobile (01XXXXXXXXX): ')),
  email: process.env.ADMIN_EMAIL ?? (await ask('Admin email: ')),
  password: process.env.ADMIN_PASSWORD ?? (await ask('Password (min 8, letter + number): ', true)),
};
if (!process.env.ADMIN_PASSWORD) {
  const again = await ask('Repeat password: ', true);
  if (again !== input.password) { console.error('Passwords do not match.'); process.exit(1); }
}

const parsed = z.object({ name: z.string().trim().min(2).max(80), phone: phoneSchema, email: emailSchema.refine(Boolean, 'required'), password: passwordSchema }).safeParse(input);
if (!parsed.success) {
  console.error('Invalid input:', parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  process.exit(1);
}

try {
  await connectDB();
  const { name, phone, email, password } = parsed.data;
  if (await User.exists({ $or: [{ phone }, { email }] })) throw new Error('A user with this phone or email already exists.');
  await User.create({ name, phone, email, passwordHash: await hashPassword(password), role: 'admin' });
  console.log(`Admin created: ${email}`);
} catch (err) {
  console.error(`Failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  await disconnectDB();
}
