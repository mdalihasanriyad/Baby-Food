import User from '../models/User.js';
import { AppError, asyncHandler } from '../utils/errors.js';
import { readSession } from '../utils/session.js';

async function loadUser(req, realm) {
  const claims = readSession(req, realm);
  if (!claims) return null;
  const user = await User.findById(claims.sub).select('+passwordChangedAt');
  if (!user || !user.isActive) return null;
  // Tokens issued before a password change are rejected.
  if (user.passwordChangedAt && claims.iat < Math.floor(user.passwordChangedAt.getTime() / 1000)) return null;
  return user;
}

export const requireCustomer = asyncHandler(async (req, _res, next) => {
  const user = await loadUser(req, 'customer');
  if (!user) throw new AppError(401, 'Authentication required', 'UNAUTHENTICATED');
  if (user.role !== 'customer') throw new AppError(403, 'Forbidden', 'FORBIDDEN');
  req.user = user;
  next();
});

// The role is re-read from the database on every request: demoting an admin takes effect immediately.
export const requireAdmin = asyncHandler(async (req, _res, next) => {
  const user = await loadUser(req, 'admin');
  if (!user) throw new AppError(401, 'Authentication required', 'UNAUTHENTICATED');
  if (user.role !== 'admin') throw new AppError(403, 'Forbidden', 'FORBIDDEN');
  req.user = user;
  next();
});
