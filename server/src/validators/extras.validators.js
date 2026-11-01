import { z } from 'zod';
import { SETUP_SLOTS } from '../models/index.js';
import { objectId } from './common.js';

const kitFields = {
  name: z.string().trim().min(3, 'Enter a kit name.').max(120),
  description: z.string().trim().min(10, 'Write at least 10 characters.').max(1000),
  audience: z.string().trim().max(120).optional(),
  semester: z.coerce.number().int().min(1).max(8).nullable().optional(),
  image: z.string().trim().max(500).optional(),
  isFeatured: z.boolean().optional(),
  isActive: z.boolean().optional(),
  items: z
    .array(
      z.object({
        product: objectId,
        qty: z.coerce
          .number()
          .int()
          .min(1, 'Enter a quantity for every product.')
          .max(20, 'Use a quantity of 20 or less.')
          .default(1),
      }),
    )
    .min(1, 'Add at least one product.')
    .max(20),
};

export const createKitSchema = z.object(kitFields);
export const updateKitSchema = z.object(kitFields).partial();

const slots = z
  .array(z.object({ slot: z.enum(SETUP_SLOTS), product: objectId }))
  .max(SETUP_SLOTS.length)
  .refine((entries) => new Set(entries.map((entry) => entry.slot)).size === entries.length, {
    message: 'Each slot can hold only one product.',
  });

const setupFields = {
  name: z.string().trim().min(1, 'Name this build.').max(80),
  budget: z.coerce.number().int().min(0).nullable().optional(),
  slots,
};

export const createSetupSchema = z.object(setupFields);
export const updateSetupSchema = z.object(setupFields).partial();

export const revenueQuery = z.object({ range: z.enum(['7d', '30d', '90d']).default('30d') });
