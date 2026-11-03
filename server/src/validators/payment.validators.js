import { z } from 'zod';
import { GATEWAY_METHODS, PAYMENT_PURPOSES, PAYMENT_RECORD_METHODS, PAYMENT_RECORD_STATUSES } from '../models/index.js';
import { DELIVERY_METHODS } from '../services/delivery.service.js';
import { TOPUP_MAX, TOPUP_MIN } from '../services/wallet.service.js';
import { digitsOnly, expiryIsCurrent, passesLuhn } from '../utils/cards.js';
import { pagination } from './common.js';

const gatewayMethod = z.enum(GATEWAY_METHODS, { message: 'Choose card or UPI.' });

export const createPaymentSchema = z.discriminatedUnion('purpose', [
  z.object({
    purpose: z.literal('order'),
    method: gatewayMethod,
    deliveryMethod: z.enum(DELIVERY_METHODS).default('standard'),
  }),
  z.object({
    purpose: z.literal('wallet_topup'),
    method: gatewayMethod,
    amount: z.coerce
      .number()
      .int('Enter a whole number of rupees.')
      .min(TOPUP_MIN, `Add at least ₹${TOPUP_MIN}.`)
      .max(TOPUP_MAX, `Add at most ₹${TOPUP_MAX.toLocaleString('en-IN')} at a time.`),
  }),
]);

export const cardSchema = z.object({
  number: z
    .string()
    .transform(digitsOnly)
    .pipe(z.string().regex(/^\d{12,19}$/, 'Enter the full card number.').refine(passesLuhn, 'This card number is not valid.')),
  name: z.string().trim().min(2, 'Enter the name on the card.').max(60),
  expiry: z
    .string()
    .trim()
    .regex(/^(0[1-9]|1[0-2])\/\d{2}$/, 'Enter the expiry as MM/YY.')
    .refine((value) => expiryIsCurrent(value), 'This card has expired.'),
  cvv: z.string().trim().regex(/^\d{3}$/, 'Enter the 3-digit CVV.'),
});

export const otpSchema = z.object({ otp: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit OTP.') });

export const upiSchema = z.object({
  upiId: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{2,64}@[a-z][a-z0-9]{1,30}$/, 'Enter a UPI ID like yourname@bank.'),
});

export const approvalSchema = z.object({ token: z.string().regex(/^[a-f\d]{32}$/, 'This payment link is not valid.') });

export const listPaymentsQuery = z.object({
  ...pagination,
  limit: pagination.limit.default(15),
  status: z.enum(PAYMENT_RECORD_STATUSES).optional(),
  method: z.enum(PAYMENT_RECORD_METHODS).optional(),
  purpose: z.enum(PAYMENT_PURPOSES).optional(),
  search: z.string().trim().max(100).optional(),
});

export const walletQuery = z.object({ ...pagination, limit: pagination.limit.default(10) });

export const listWalletQuery = z.object({
  ...pagination,
  limit: pagination.limit.default(15),
  type: z.enum(['credit', 'debit']).optional(),
  search: z.string().trim().max(100).optional(),
});
