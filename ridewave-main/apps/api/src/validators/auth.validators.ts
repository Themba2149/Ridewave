import { z } from 'zod';

const email = z.string().trim().toLowerCase().email('Enter a valid email address').max(254);
// bcrypt only uses the first 72 bytes, so cap the length instead of silently truncating.
export const password = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(72, 'Use at most 72 characters')
  .regex(/[A-Za-z]/, 'Include at least one letter')
  .regex(/[0-9]/, 'Include at least one number');
const phone = z
  .string().trim().regex(/^\+?[0-9][0-9 ]{8,16}$/, 'Enter a valid phone number')
  .optional().or(z.literal('')).transform((v) => (v ? v.replace(/\s+/g, '') : undefined));
const fullName = z.string().trim().min(2, 'Enter your full name').max(100);

// strict(): unknown fields (e.g. "isAdmin") are rejected rather than silently ignored.
// Only PASSENGER and DRIVER can ever be self-registered; ADMIN accounts are created by seeding or by an existing admin.
export const registerSchema = z
  .object({ role: z.enum(['PASSENGER', 'DRIVER']), fullName, email, phone, password })
  .strict();
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({ email, password: z.string().min(1).max(200) }).strict();
export const forgotPasswordSchema = z.object({ email }).strict();
export const resetPasswordSchema = z.object({ token: z.string().min(10).max(200), password }).strict();
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(200), newPassword: password }).strict();
export const updateProfileSchema = z
  .object({ fullName: fullName.optional(), phone: phone.or(z.null()).optional() })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field to update' });
