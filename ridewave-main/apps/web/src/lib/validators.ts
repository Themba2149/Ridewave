import { z } from 'zod';

const email = z.string().trim().min(1, 'Enter your email address').email('Enter a valid email address');
const password = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(72, 'Use at most 72 characters')
  .regex(/[A-Za-z]/, 'Include at least one letter')
  .regex(/[0-9]/, 'Include at least one number');

export const tripPreviewSchema = z
  .object({ pickup: z.string().trim().min(3, 'Enter a pickup location'), destination: z.string().trim().min(3, 'Enter a destination') })
  .refine((v) => v.pickup.toLowerCase() !== v.destination.toLowerCase(), { path: ['destination'], message: 'Destination must differ from pickup' });
export type TripPreviewValues = z.infer<typeof tripPreviewSchema>;

export const loginSchema = z.object({ email, password: z.string().min(1, 'Enter your password') });
export type LoginValues = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    role: z.enum(['PASSENGER', 'DRIVER']),
    fullName: z.string().trim().min(2, 'Enter your full name'),
    email,
    phone: z.string().trim().regex(/^(\+?[0-9][0-9 ]{8,16})?$/, 'Enter a valid phone number').optional().or(z.literal('')),
    password,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' });
export type RegisterValues = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({ email });
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({ password, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' });
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

export const contactSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name'),
  email,
  subject: z.string().trim().min(3, 'Enter a subject'),
  message: z.string().trim().min(10, 'Message must be at least 10 characters').max(2000, 'Message is too long (2000 characters max)'),
});
export type ContactValues = z.infer<typeof contactSchema>;

export const profileSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name').max(100),
  phone: z.string().trim().regex(/^(\+?[0-9][0-9 ]{8,16})?$/, 'Enter a valid phone number'),
});
export type ProfileValues = z.infer<typeof profileSchema>;

export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1, 'Enter your current password'), newPassword: password, confirmPassword: z.string() })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' });
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

export const vehicleSchema = z.object({
  categoryCode: z.string().min(1, 'Choose a ride category'),
  make: z.string().trim().min(2, 'Enter the make'),
  model: z.string().trim().min(1, 'Enter the model'),
  year: z.coerce.number({ invalid_type_error: 'Enter the year' }).int().min(1995, 'Year must be 1995 or later').max(new Date().getFullYear() + 1, 'Year is in the future'),
  colour: z.string().trim().min(2, 'Enter the colour'),
  registration: z.string().trim().min(3, 'Enter the registration').max(15),
  passengerCapacity: z.coerce.number({ invalid_type_error: 'Enter the seat count' }).int().min(2, 'At least 2 seats').max(10),
});
export type VehicleValues = z.infer<typeof vehicleSchema>;
