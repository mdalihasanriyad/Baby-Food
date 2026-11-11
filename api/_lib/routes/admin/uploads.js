import express, { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AppError, asyncHandler } from '../../utils/errors.js';
import { sniff, storeImage } from '../../services/imageStorage.js';

const router = Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: true, legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many uploads. Try again later.' } }) });

// The image is sent as the raw request body (Content-Type: image/jpeg|png|webp). 4 MB max
// (Vercel serverless functions reject bodies above ~4.5 MB).
router.post('/', limiter, express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '4mb' }), asyncHandler(async (req, res) => {
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    throw new AppError(415, 'Send a JPEG, PNG or WebP image as the request body', 'UNSUPPORTED_MEDIA');
  }
  const kind = sniff(req.body);
  if (!kind) throw new AppError(415, 'File content is not a valid JPEG, PNG or WebP image', 'UNSUPPORTED_MEDIA');
  res.status(201).json(await storeImage(req.body, kind));
}));

export default router;
