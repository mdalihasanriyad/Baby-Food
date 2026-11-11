import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { MongoRateLimitStore } from './mongoRateLimitStore.js';

// In automated tests the limiters are off, except in the one test file that turns them on (RATE_LIMIT_TEST_MODE=on).
// RATE_LIMIT_NAMESPACE gives each test run fresh counters. Neither variable has any effect outside NODE_ENV=test.
const inTest = env.NODE_ENV === 'test';
const bypass = () => inTest && process.env.RATE_LIMIT_TEST_MODE !== 'on';
const namespace = inTest ? process.env.RATE_LIMIT_NAMESPACE ?? '' : '';

const tooMany = (message) => (_req, res) => res.status(429).json({ error: { code: 'RATE_LIMITED', message } });
const base = { standardHeaders: true, legacyHeaders: false, skip: bypass };

// Cheap, in-memory soft limit for general traffic (per instance only; fine for plain reading).
export const apiLimiter = rateLimit({ ...base, windowMs: 15 * 60 * 1000, limit: 300, handler: tooMany('Too many requests. Please try again later.') });

// Sensitive actions use the shared MongoDB-backed counter so the limit holds across serverless instances.
const shared = (name, windowMs, limit, message, extra = {}) =>
  rateLimit({ ...base, windowMs, limit, store: new MongoRateLimitStore({ prefix: `${namespace}${name}:` }), handler: tooMany(message), ...extra });

// Login and password checks: only FAILED attempts count, so normal customers are never blocked.
export const loginLimiter = shared('login', 15 * 60 * 1000, 10, 'Too many failed attempts. Try again later.', { skipSuccessfulRequests: true });
export const registerLimiter = shared('register', 60 * 60 * 1000, 10, 'Too many sign-ups from this network. Try again later.');
export const contactLimiter = shared('contact', 60 * 60 * 1000, 5, 'Too many messages. Please try again later.');
export const reviewLimiter = shared('review', 60 * 60 * 1000, 10, 'Too many reviews submitted. Try again later.');
export const orderLimiter = shared('order', 60 * 60 * 1000, 20, 'Too many orders from this network. Try again later.');
export const cancelLimiter = shared('cancel', 60 * 60 * 1000, 20, 'Too many requests. Try again later.');
