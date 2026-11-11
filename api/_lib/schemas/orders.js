import { z } from 'zod';
import { DELIVERY_ZONES } from '../models/constants.js';
import { DISTRICT_VALUES } from '../constants/districts.js';
import { objectId } from './catalog.js';
import { phoneSchema } from './auth.js';

const req = { required_error: 'required', invalid_type_error: 'required' };
const line = z.object({ productId: objectId, quantity: z.number(req).int().min(1).max(50) });

export const quoteSchema = z.object({
  items: z.array(line).min(1).max(30),
  deliveryZone: z.enum(DELIVERY_ZONES).optional(),
});

export const orderCreate = z.object({
  items: z.array(line).min(1).max(30),
  customer: z.object({
    name: z.string(req).trim().min(2, 'name_short').max(80, 'too_long'),
    phone: phoneSchema,
    address: z.string(req).trim().min(5, 'address_short').max(300, 'too_long'),
    district: z.enum(DISTRICT_VALUES, { errorMap: () => ({ message: 'invalid' }) }),
    area: z.string().trim().max(80, 'too_long').optional(),
  }),
  deliveryZone: z.enum(DELIVERY_ZONES),
  paymentMethod: z.enum(['cod']),
  idempotencyKey: z.string(req).regex(/^[A-Za-z0-9_-]{16,80}$/, 'invalid'),
  attribution: z.object({
    utmSource: z.string().trim().max(100).optional(),
    utmMedium: z.string().trim().max(100).optional(),
    utmCampaign: z.string().trim().max(100).optional(),
  }).optional(),
});
