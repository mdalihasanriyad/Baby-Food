import { z } from 'zod';
import { DELIVERY_ZONES, ORDER_STATUSES, PAYMENT_STATUSES, REVIEW_STATUSES } from '../models/constants.js';
import { PRESETS } from '../utils/dhaka.js';
import { objectId } from './catalog.js';

const page = z.coerce.number().int().min(1).max(100000).default(1);
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

export const rangeQuery = z.object({ preset: z.enum(PRESETS).default('last30'), from: dateStr.optional(), to: dateStr.optional() });

export const reportQuery = rangeQuery.extend({
  groupBy: z.enum(['day', 'month', 'year']).default('month'),
  page, limit: z.coerce.number().int().min(1).max(100).default(24),
});

export const adminOrderList = rangeQuery.extend({
  preset: z.enum(PRESETS).default('all'),
  page, limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(80).optional(),
  status: z.enum(ORDER_STATUSES).optional(),
  paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
  deliveryZone: z.enum(DELIVERY_ZONES).optional(),
  customer: objectId.optional(),
  sort: z.enum(['new', 'old', 'total_desc', 'total_asc']).default('new'),
});

export const statusChange = z.object({ status: z.enum(ORDER_STATUSES), note: z.string().trim().max(300).optional() });
export const noteCreate = z.object({ text: z.string().trim().min(1, 'Required').max(500) });
export const paymentChange = z.object({ paymentStatus: z.enum(PAYMENT_STATUSES) });

export const customerList = z.object({ page, limit: z.coerce.number().int().min(1).max(100).default(20), q: z.string().trim().max(80).optional() });
export const customerUpdate = z.object({ isActive: z.boolean() });

export const reviewList = z.object({
  page, limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(REVIEW_STATUSES).optional(),
});
export const reviewUpdate = z.object({ status: z.enum(REVIEW_STATUSES) });

const taka = z.number({ invalid_type_error: 'Must be a number' }).int('Whole taka only').min(0).max(100000);
const text = (max) => z.string().trim().max(max);
const https = text(200).refine((v) => v === '' || v.startsWith('https://'), 'Must start with https://');
export const settingsUpdate = z.object({
  delivery: z.object({ insideDhaka: taka, outsideDhaka: taka }).partial(),
  contact: z.object({
    phone: text(30), whatsapp: text(30), address: text(300), facebook: https, instagram: https,
    email: text(254).refine((v) => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Enter a valid email'),
  }).partial(),
  about: z.object({ bn: text(4000), en: text(4000) }).partial(),
  metaPixelId: z.string().trim().refine((v) => v === '' || /^\d{5,20}$/.test(v), 'Pixel ID is 5-20 digits'),
  lowStockThreshold: z.number().int().min(0).max(100000),
}).partial();
