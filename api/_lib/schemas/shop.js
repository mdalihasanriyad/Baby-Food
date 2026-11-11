import { z } from 'zod';

export const reviewCreate = z.object({
  rating: z.number({ required_error: 'required', invalid_type_error: 'required' }).int('rating must be a whole number').min(1).max(5),
  comment: z.string().trim().max(1000, 'too_long').optional(),
});
export const reviewList = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(20).default(5),
});
