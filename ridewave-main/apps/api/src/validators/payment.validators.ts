import { z } from 'zod';

export const checkoutSchema = z
  .object({ rideId: z.string().min(1).max(64), method: z.enum(['CASH', 'CARD', 'DIGITAL_WALLET']), paymentMethodId: z.string().min(1).max(64).optional() })
  .strict()
  .refine((v) => v.method === 'CASH' || !!v.paymentMethodId, { path: ['paymentMethodId'], message: 'Choose a saved payment method' });
export const paymentIdParams = z.object({ paymentId: z.string().min(1).max(64) });

// Only a label and the LAST FOUR digits are ever accepted. strict() rejects fields such as cardNumber or cvv outright.
export const paymentMethodSchema = z
  .object({ type: z.enum(['CARD', 'DIGITAL_WALLET']), label: z.string().trim().min(1).max(40), last4: z.string().regex(/^\d{4}$/, 'Enter only the last 4 digits of the card').optional(), isDefault: z.boolean().optional() })
  .strict()
  .refine((v) => v.type !== 'CARD' || !!v.last4, { path: ['last4'], message: 'Enter the last 4 digits of the card' });
export const paymentMethodParams = z.object({ methodId: z.string().min(1).max(64) });
export const notificationsQuerySchema = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(50).default(20), unread: z.enum(['true', 'false']).default('false') });
export const notificationParams = z.object({ notificationId: z.string().min(1).max(64) });
