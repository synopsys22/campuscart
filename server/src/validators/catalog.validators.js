import { z } from 'zod';
import { SETUP_SLOTS } from '../models/index.js';
import { booleanQuery, objectId, pagination } from './common.js';

/**
 * A whole number sent as a number or as form text. A blank field counts as missing,
 * because plain coercion would quietly turn it into 0, and a product would sell for free.
 */
const wholeNumber = (min, tooLow) =>
  z.preprocess(
    (value) => (value === '' || value === null ? undefined : value),
    z.coerce.number({ message: 'Enter a number.' }).int('Use a whole number.').min(min, tooLow),
  );

const rupees = wholeNumber(1, 'Must be at least ₹1.');
const count = wholeNumber(0, 'Cannot be negative.');
const semesters = z.array(z.number().int().min(1).max(8));

export const PRODUCT_SORTS = {
  featured: { isFeatured: -1, soldCount: -1, _id: 1 },
  newest: { createdAt: -1, _id: 1 },
  popular: { soldCount: -1, _id: 1 },
  rating: { ratingAvg: -1, ratingCount: -1, _id: 1 },
  price_asc: { price: 1, _id: 1 },
  price_desc: { price: -1, _id: 1 },
};

export const listProductsQuery = z.object({
  ...pagination,
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().optional(),
  brand: z.string().trim().optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  rating: z.coerce.number().min(0).max(5).optional(),
  inStock: booleanQuery.optional(),
  semester: z.coerce.number().int().min(1).max(8).optional(),
  includeInactive: booleanQuery.optional(),
  lowStock: booleanQuery.optional(),
  sort: z.enum(Object.keys(PRODUCT_SORTS)).default('featured'),
});

export const suggestQuery = z.object({ q: z.string().trim().max(100).default('') });

export const compareQuery = z.object({
  ids: z
    .string()
    .transform((value) => value.split(',').filter(Boolean))
    .pipe(z.array(objectId).min(1, 'Choose at least one product.').max(4, 'Compare up to 4 products.')),
});

const productFields = {
  name: z.string().trim().min(2, 'Enter a product name.').max(160),
  brand: z.string().trim().min(1, 'Enter a brand.').max(80),
  sku: z.string().trim().min(2, 'Enter a SKU.').max(40),
  description: z.string().trim().min(10, 'Write at least 10 characters.').max(4000),
  category: objectId,
  price: rupees,
  mrp: rupees,
  stock: count,
  highlights: z.array(z.string().trim().min(1).max(200)).max(10),
  tags: z.array(z.string().trim().min(1).max(40)).max(20),
  images: z.array(z.string().trim().min(1).max(500)).max(8),
  specs: z
    .array(
      z.object({
        group: z.string().trim().max(60).default('General'),
        key: z.string().trim().min(1, 'Enter a spec name.').max(60),
        value: z.string().trim().min(1, 'Enter a spec value.').max(200),
      }),
    )
    .max(60),
  lowStockThreshold: count,
  setupSlot: z.enum(SETUP_SLOTS).nullable(),
  semesters,
  isFeatured: z.boolean(),
  isActive: z.boolean(),
};

const required = ['name', 'brand', 'sku', 'description', 'category', 'price', 'mrp', 'stock'];
const createFields = Object.fromEntries(
  Object.entries(productFields).map(([key, schema]) => [
    key,
    required.includes(key) ? schema : schema.optional(),
  ]),
);

export const createProductSchema = z.object(createFields);
export const updateProductSchema = z.object(productFields).partial();
export const updateStockSchema = z.object({ stock: count });

const categoryFields = {
  name: z.string().trim().min(2, 'Enter a category name.').max(80),
  description: z.string().trim().max(400).optional(),
  icon: z.string().trim().max(40).optional(),
  sortOrder: z.coerce.number().int().optional(),
  isActive: z.boolean().optional(),
};

export const createCategorySchema = z.object(categoryFields);
export const updateCategorySchema = z.object(categoryFields).partial();
