import { z } from 'zod';
import { pagination } from './common.js';

const email = z.string().trim().toLowerCase().email('Enter a valid email address.');
const password = z.string().min(8, 'Use at least 8 characters.').max(72);
const name = z.string().trim().min(1, 'Enter your name.').max(80);
const semester = z.coerce.number().int().min(1).max(8);

// Unknown fields such as "role" are dropped by these schemas, so nobody can self-promote.
export const registerSchema = z.object({
  name,
  email,
  password,
  college: z.string().trim().max(120).optional(),
  branch: z.string().trim().max(80).optional(),
  semester: semester.optional(),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password.'),
});

export const updateProfileSchema = z.object({
  name: name.optional(),
  phone: z.string().trim().max(20).optional(),
  college: z.string().trim().max(120).optional(),
  branch: z.string().trim().max(80).optional(),
  semester: semester.nullable().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password.'),
  newPassword: password,
});

export const listUsersQuery = z.object({
  ...pagination,
  search: z.string().trim().max(100).optional(),
  role: z.enum(['student', 'admin']).optional(),
});

export const adminUpdateUserSchema = z.object({
  role: z.enum(['student', 'admin']).optional(),
  isActive: z.boolean().optional(),
});
