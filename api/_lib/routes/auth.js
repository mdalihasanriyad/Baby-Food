import { Router } from 'express';
import User from '../models/User.js';
import { AppError, asyncHandler } from '../utils/errors.js';
import { validate } from '../middleware/validate.js';
import { requireCustomer } from '../middleware/auth.js';
import { loginLimiter, registerLimiter } from '../middleware/rateLimits.js';
import { noStore } from '../middleware/cache.js';
import { loginSchema, registerSchema } from '../schemas/auth.js';
import { hashPassword } from '../utils/password.js';
import { authenticate } from '../utils/authenticate.js';
import { clearSession, issueSession, publicUser } from '../utils/session.js';

const router = Router();
router.use(noStore);

router.post('/register', registerLimiter, validate(registerSchema), asyncHandler(async (req, res) => {
  const { name, phone, email, password } = req.valid;
  const doc = { name, phone, passwordHash: await hashPassword(password), role: 'customer' }; // role is NEVER taken from input
  if (email) doc.email = email;
  const user = await User.create(doc); // duplicate phone/email -> 409 via the central error handler
  issueSession(res, user, 'customer');
  res.status(201).json({ user: publicUser(user) });
}));

router.post('/login', loginLimiter, validate(loginSchema), asyncHandler(async (req, res) => {
  const user = await authenticate(req.valid.identifier, req.valid.password, 'customer');
  if (!user) throw new AppError(401, 'Incorrect phone/email or password', 'INVALID_CREDENTIALS');
  issueSession(res, user, 'customer');
  res.json({ user: publicUser(user) });
}));

router.post('/logout', (_req, res) => {
  clearSession(res, 'customer');
  res.json({ ok: true });
});

router.get('/me', requireCustomer, (req, res) => res.json({ user: publicUser(req.user) }));

export default router;
