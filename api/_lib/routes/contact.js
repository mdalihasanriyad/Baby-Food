import { Router } from 'express';
import { z } from 'zod';
import ContactMessage from '../models/ContactMessage.js';
import { asyncHandler } from '../utils/errors.js';
import { validate } from '../middleware/validate.js';
import { contactLimiter } from '../middleware/rateLimits.js';
import { noStore } from '../middleware/cache.js';
import { BD_PHONE_RE } from '../models/constants.js';

const router = Router();

const schema = z.object({
  name: z.string().trim().min(2, 'Name is too short').max(80),
  phone: z.string().trim().regex(BD_PHONE_RE, 'Enter a valid Bangladesh mobile number'),
  message: z.string().trim().min(10, 'Message is too short').max(1000),
  website: z.string().max(200).optional(), // honeypot: real users never see or fill this field
});

router.post('/', noStore, contactLimiter, validate(schema), asyncHandler(async (req, res) => {
  const { website, ...data } = req.valid;
  if (!website) await ContactMessage.create(data);
  res.status(201).json({ ok: true }); // bots get the same response and nothing is stored
}));

export default router;
