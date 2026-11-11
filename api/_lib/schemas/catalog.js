import { z } from 'zod';
import { SLUG_RE } from '../models/constants.js';

export const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id');
export const idParam = z.object({ id: objectId });

const bil = (max) => z.object({ bn: z.string().trim().max(max).optional(), en: z.string().trim().max(max).optional() });
const bilReq = (max) => z.object({ bn: z.string().trim().min(1, 'Required').max(max), en: z.string().trim().min(1, 'Required').max(max) });

// Only our own storage: https URLs (e.g. Cloudinary) or /uploads/ files from the dev provider.
const imageUrl = z.string().trim().max(500).refine(
  (u) => (u.startsWith('https://') || u.startsWith('/uploads/')) && !u.includes('..'),
  'Image URL must be https or an /uploads/ path'
);
const image = z.object({ url: imageUrl, alt: z.string().trim().max(160).optional() });
const slug = z.string().trim().toLowerCase().max(120).regex(SLUG_RE, 'Use lowercase letters, numbers and hyphens');
const taka = (min) => z.number({ invalid_type_error: 'Must be a number' }).int('Whole taka only').min(min).max(10_000_000);

const productBase = z.object({
  name: bilReq(160),
  slug: slug.optional(),
  sku: z.string().trim().toUpperCase().min(2).max(40).regex(/^[A-Z0-9][A-Z0-9._-]*$/, 'Letters, numbers, . _ - only'),
  description: bil(4000).optional(),
  details: z.object({ ingredients: bil(2000).optional(), ageInfo: bil(500).optional(), other: bil(2000).optional() }).optional(),
  category: objectId,
  brand: z.string().trim().max(80).optional(),
  price: taka(1),
  salePrice: taka(1).nullable().optional(),
  costPrice: taka(0).nullable().optional(),
  stock: z.number({ invalid_type_error: 'Must be a number' }).int('Whole units only').min(0).max(1_000_000),
  images: z.array(image).max(8).optional(),
  isPublished: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  isBestseller: z.boolean().optional(),
  seo: z.object({ title: z.string().trim().max(70).optional(), metaDescription: z.string().trim().max(160).optional() }).optional(),
});

const saleBelowPrice = (d, ctx) => {
  if (d.salePrice != null && d.price != null && d.salePrice >= d.price) {
    ctx.addIssue({ code: 'custom', path: ['salePrice'], message: 'Sale price must be lower than the regular price' });
  }
};
export const productCreate = productBase.superRefine(saleBelowPrice);
export const productUpdate = productBase.partial().superRefine(saleBelowPrice);

export const productList = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(80).optional(),
  category: objectId.optional(),
  status: z.enum(['active', 'archived', 'all']).default('active'),
  published: z.enum(['true', 'false']).optional(),
  stock: z.enum(['in', 'low', 'out']).optional(),
  sort: z.enum(['new', 'updated', 'name', 'price_asc', 'price_desc', 'stock_asc', 'stock_desc']).default('new'),
});

export const stockChange = z
  .object({
    stock: z.number().int().min(0).max(1_000_000).optional(),
    delta: z.number().int().min(-1_000_000).max(1_000_000).optional(),
  })
  .refine((d) => (d.stock === undefined) !== (d.delta === undefined), 'Provide either stock or delta');

const categoryBase = z.object({
  name: bilReq(80),
  slug: slug.optional(),
  description: bil(500).optional(),
  image: image.nullable().optional(),
  group: z.enum(['baby', 'adult', 'other']).optional(),
  isVisible: z.boolean().optional(),
  sortOrder: z.number().int().min(-1000).max(1000).optional(),
});
export const categoryCreate = categoryBase;
export const categoryUpdate = categoryBase.partial();
export const categoryDelete = z.object({ reassignTo: objectId.optional() });
