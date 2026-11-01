import { z } from 'zod';
import { MAX_PAGE_SIZE } from '../utils/http.js';

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id.');
export const idParams = z.object({ id: objectId });

export const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(12),
};

export const booleanQuery = z.enum(['true', 'false']).transform((value) => value === 'true');

export const addressSchema = z.object({
  label: z.string().trim().max(40).default('Home'),
  line1: z.string().trim().min(3, 'Enter the street address.').max(160),
  line2: z.string().trim().max(160).default(''),
  city: z.string().trim().min(1, 'Enter the city.').max(80),
  state: z.string().trim().min(1, 'Enter the state.').max(80),
  pincode: z.string().trim().regex(/^\d{6}$/, 'Enter a 6-digit pincode.'),
});
