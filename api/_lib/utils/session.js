import jwt from 'jsonwebtoken';
import { env, isProd } from '../config/env.js';
import { AppError } from './errors.js';

// Two fully separate sessions: different cookie, audience, lifetime and cookie scope.
export const REALMS = {
  customer: { cookie: 'bfg_session', path: '/api', ttlSec: 7 * 24 * 3600, sameSite: 'lax' },
  admin: { cookie: 'bfg_admin', path: '/api/admin', ttlSec: 8 * 3600, sameSite: 'strict' },
};

export function secret() {
  if (!env.JWT_SECRET) throw new AppError(503, 'Authentication is not configured', 'AUTH_NOT_CONFIGURED');
  return env.JWT_SECRET;
}

const base = (r) => ({ httpOnly: true, secure: isProd, sameSite: r.sameSite, path: r.path });

export function issueSession(res, user, realm) {
  const r = REALMS[realm];
  const token = jwt.sign({}, secret(), { subject: String(user._id), audience: realm, expiresIn: r.ttlSec, algorithm: 'HS256' });
  res.cookie(r.cookie, token, { ...base(r), maxAge: r.ttlSec * 1000 });
}

export const clearSession = (res, realm) => res.clearCookie(REALMS[realm].cookie, base(REALMS[realm]));

export function readSession(req, realm) {
  const token = req.cookies?.[REALMS[realm].cookie];
  if (!token) return null;
  try {
    return jwt.verify(token, secret(), { audience: realm, algorithms: ['HS256'] });
  } catch (err) {
    if (err instanceof AppError) throw err;
    return null; // expired / tampered / wrong audience
  }
}

export const publicUser = (u) => ({ id: String(u._id), name: u.name, phone: u.phone, email: u.email ?? null, role: u.role });
