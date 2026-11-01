import { z } from 'zod';
import { ORDER_STATUSES, PAYMENT_METHODS } from '../models/index.js';
import { addressSchema, objectId, pagination } from './common.js';

const quantity = z.coerce.number().int('Quantity must be a whole number.').min(1, 'Quantity must be at least 1.').max(99);

export const addCartItemSchema = z.object({ productId: objectId, qty: quantity.default(1) });
export const updateCartItemSchema = z.object({ qty: quantity });
export const productIdParams = z.object({ productId: objectId });
export const applyCouponSchema = z.object({
  code: z.string().trim().min(1, 'Enter a coupon code.').max(40).toUpperCase(),
});

export const placeOrderSchema = z.object({
  address: addressSchema,
  paymentMethod: z.enum(PAYMENT_METHODS, { message: 'Choose a payment method.' }),
});

export const listOrdersQuery = z.object({
  ...pagination,
  status: z.enum(ORDER_STATUSES).optional(),
  search: z.string().trim().max(100).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const myOrdersQuery = z.object({ ...pagination, status: z.enum(ORDER_STATUSES).optional() });

export const updateOrderStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  note: z.string().trim().max(300).optional(),
});

export const cancelOrderSchema = z.object({ reason: z.string().trim().max(300).optional() });

const reviewFields = {
  rating: z.coerce.number().int().min(1, 'Choose 1 to 5 stars.').max(5, 'Choose 1 to 5 stars.'),
  title: z.string().trim().min(3, 'Write a short title.').max(100),
  body: z.string().trim().min(10, 'Write at least 10 characters.').max(2000),
};

export const createReviewSchema = z.object(reviewFields);
export const updateReviewSchema = z.object(reviewFields).partial();
export const listReviewsQuery = z.object({ ...pagination, limit: pagination.limit.default(10) });

const couponFields = {
  code: z.string().trim().min(3, 'Use at least 3 characters.').max(40).toUpperCase(),
  description: z.string().trim().max(200).optional(),
  type: z.enum(['percent', 'flat']),
  value: z.coerce.number().int().min(1, 'Must be at least 1.'),
  minOrder: z.coerce.number().int().min(0).optional(),
  maxDiscount: z.coerce.number().int().min(0).nullable().optional(),
  startsAt: z.coerce.date().nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  usageLimit: z.coerce.number().int().min(1).nullable().optional(),
  perUserLimit: z.coerce.number().int().min(1).nullable().optional(),
  isActive: z.boolean().optional(),
};

const percentAtMost100 = (coupon) => coupon.type !== 'percent' || coupon.value === undefined || coupon.value <= 100;
const percentMessage = { message: 'A percent discount cannot be above 100.', path: ['value'] };

export const createCouponSchema = z.object(couponFields).refine(percentAtMost100, percentMessage);
export const updateCouponSchema = z.object(couponFields).partial().refine(percentAtMost100, percentMessage);
