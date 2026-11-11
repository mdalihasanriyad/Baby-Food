import User from '../models/User.js';
import { normalizePhone } from './phone.js';
import { dummyHash, verifyPassword } from './password.js';

const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;

// Returns the user, or null for ANY failure (unknown account, wrong password, wrong role, disabled, locked).
// Callers must show one generic message so accounts cannot be enumerated.
export async function authenticate(identifier, password, role) {
  const query = identifier.includes('@') ? { email: identifier.toLowerCase() } : { phone: normalizePhone(identifier) };
  const user = await User.findOne(query).select('+passwordHash +failedLoginCount +lockUntil');
  const ok = await verifyPassword(password, user?.passwordHash ?? (await dummyHash())); // constant-ish timing
  if (!user || user.role !== role || !user.isActive) return null;
  if (user.lockUntil && user.lockUntil > new Date()) return null;

  if (!ok) {
    user.failedLoginCount = (user.failedLoginCount ?? 0) + 1;
    if (user.failedLoginCount >= MAX_FAILS) { user.lockUntil = new Date(Date.now() + LOCK_MS); user.failedLoginCount = 0; }
    await user.save();
    return null;
  }
  if (user.failedLoginCount || user.lockUntil) { user.failedLoginCount = 0; user.lockUntil = undefined; await user.save(); }
  return user;
}
