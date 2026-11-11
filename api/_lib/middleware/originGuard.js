import { AppError } from '../utils/errors.js';

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

// CSRF defense in depth (on top of SameSite cookies): state-changing browser requests must come from our own origin.
export const originGuard = (allowed) => (req, _res, next) => {
  if (SAFE.has(req.method)) return next();
  const origin = req.get('origin');
  if (origin && !allowed.includes(origin)) return next(new AppError(403, 'Forbidden origin', 'BAD_ORIGIN'));
  return next();
};
