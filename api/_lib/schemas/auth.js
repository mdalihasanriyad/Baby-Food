import { z } from 'zod';
import { LOCAL_PHONE_RE, normalizePhone } from '../utils/phone.js';

// Messages are stable codes; the client translates them (auth.v.<code>).
const str = (max = 200) => z.string({ required_error: 'required', invalid_type_error: 'required' }).trim().max(max, 'too_long');

export const passwordSchema = z
  .string({ required_error: 'required', invalid_type_error: 'required' })
  .min(8, 'password_short')
  .refine((s) => Buffer.byteLength(s, 'utf8') <= 72, 'password_long') // bcrypt input limit
  .refine((s) => /\p{L}/u.test(s) && /\p{N}/u.test(s), 'password_weak');

export const phoneSchema = str(20).transform(normalizePhone).refine((v) => LOCAL_PHONE_RE.test(v), 'phone_invalid');

export const emailSchema = z
  .string().trim().toLowerCase().max(254, 'too_long').email('email_invalid')
  .optional().or(z.literal('').transform(() => undefined));

export const registerSchema = z
  .object({
    name: str(80).min(2, 'name_short'),
    phone: phoneSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string({ required_error: 'required', invalid_type_error: 'required' }),
  })
  .refine((d) => d.password === d.confirmPassword, { path: ['confirmPassword'], message: 'password_mismatch' });

export const loginSchema = z.object({
  identifier: str(254).min(1, 'required'), // phone or email
  password: z.string({ required_error: 'required', invalid_type_error: 'required' }).min(1, 'required').max(200),
});
