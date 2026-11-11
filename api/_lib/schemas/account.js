import { z } from 'zod';
import { emailSchema, passwordSchema, phoneSchema } from './auth.js';

const req = { required_error: 'required', invalid_type_error: 'required' };

export const profileUpdate = z.object({
  name: z.string(req).trim().min(2, 'name_short').max(80, 'too_long'),
  phone: phoneSchema,
  email: emailSchema,
  currentPassword: z.string().max(200).optional(), // required only when phone or email changes
});

export const passwordChange = z
  .object({
    currentPassword: z.string(req).min(1, 'required').max(200),
    newPassword: passwordSchema,
    confirmPassword: z.string(req),
  })
  .refine((d) => d.newPassword === d.confirmPassword, { path: ['confirmPassword'], message: 'password_mismatch' })
  .refine((d) => d.newPassword !== d.currentPassword, { path: ['newPassword'], message: 'password_same' });

export const orderListQuery = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(20).default(10),
  status: z.enum(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']).optional(),
});

export const cancelBody = z.object({ reason: z.string().trim().max(200).optional() });
