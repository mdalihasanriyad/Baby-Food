import { Router } from 'express';
import { AppError, asyncHandler } from '../utils/errors.js';
import { validate } from '../middleware/validate.js';
import { requireAdmin } from '../middleware/auth.js';
import { loginLimiter } from '../middleware/rateLimits.js';
import { loginSchema } from '../schemas/auth.js';
import { authenticate } from '../utils/authenticate.js';
import { clearSession, issueSession, publicUser } from '../utils/session.js';

const router = Router();

// There is intentionally NO admin registration route. Admins are created only by `npm run create-admin`.
router.post('/login', loginLimiter, validate(loginSchema), asyncHandler(async (req, res) => {
  const user = await authenticate(req.valid.identifier, req.valid.password, 'admin');
  if (!user) throw new AppError(401, 'Incorrect email/phone or password', 'INVALID_CREDENTIALS'); // same message for customers
  issueSession(res, user, 'admin');
  res.json({ user: publicUser(user) });
}));

router.post('/logout', (_req, res) => {
  clearSession(res, 'admin');
  res.json({ ok: true });
});

router.get('/me', requireAdmin, (req, res) => res.json({ user: publicUser(req.user) }));

export default router;
