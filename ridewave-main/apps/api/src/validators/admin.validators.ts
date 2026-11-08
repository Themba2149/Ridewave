import { z } from 'zod';

const page = { page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20) };
const idParam = (name: string) => z.object({ [name]: z.string().min(1).max(64) });
const cents = z.number().int().min(0).max(1_000_000);

export const adminUsersQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  role: z.enum(['PASSENGER', 'DRIVER', 'ADMIN']).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DEACTIVATED']).optional(),
  sort: z.enum(['createdAt', 'fullName', 'email', 'role']).default('createdAt'),
  dir: z.enum(['asc', 'desc']).default('desc'),
  ...page,
});
export const userIdParams = idParam('userId');
export const userStatusSchema = z.object({ status: z.enum(['ACTIVE', 'SUSPENDED', 'DEACTIVATED']), reason: z.string().trim().max(200).optional() }).strict();

export const driversQuerySchema = z.object({ approval: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED']).optional(), search: z.string().trim().max(100).optional(), ...page });
export const driverIdParams = idParam('driverId');
export const driverApprovalSchema = z
  .object({ status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED']), note: z.string().trim().max(500).optional() })
  .strict()
  .refine((v) => !['REJECTED', 'SUSPENDED'].includes(v.status) || (v.note && v.note.length >= 3), { path: ['note'], message: 'Give a reason (at least 3 characters) when rejecting or suspending' });

export const documentIdParams = idParam('documentId');
export const documentReviewSchema = z
  .object({ status: z.enum(['ACCEPTED', 'REJECTED']), note: z.string().trim().max(500).optional() })
  .strict()
  .refine((v) => v.status !== 'REJECTED' || (v.note && v.note.length >= 3), { path: ['note'], message: 'Give a reason when rejecting a document' });
export const documentUploadSchema = z.object({ type: z.enum(['DRIVERS_LICENCE', 'ID_DOCUMENT', 'PROOF_OF_ADDRESS', 'VEHICLE_REGISTRATION', 'VEHICLE_INSURANCE', 'PROFILE_PHOTO']) });

export const vehiclesQuerySchema = z.object({ search: z.string().trim().max(100).optional(), active: z.enum(['true', 'false']).optional(), ...page });
export const vehicleIdParams = idParam('vehicleId');
export const vehicleActiveSchema = z.object({ isActive: z.boolean() }).strict();

export const adminRidesQuerySchema = z.object({
  status: z.enum(['REQUESTED', 'SEARCHING_FOR_DRIVER', 'DRIVER_ASSIGNED', 'DRIVER_ARRIVING', 'DRIVER_ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_DRIVER_AVAILABLE']).optional(),
  search: z.string().trim().max(100).optional(), ...page,
});
export const adminRideIdParams = idParam('rideId');
export const adminCancelSchema = z.object({ reason: z.string().trim().min(3, 'Give a reason').max(200) }).strict();

export const categoryIdParams = idParam('categoryId');
export const categoryUpdateSchema = z
  .object({ name: z.string().trim().min(2).max(60), description: z.string().trim().min(2).max(200), capacity: z.number().int().min(1).max(12), isActive: z.boolean(), sortOrder: z.number().int().min(0).max(100) })
  .partial().strict().refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field to update' });

export const pricingUpdateSchema = z
  .object({
    categoryCode: z.string().trim().min(1).max(30),
    baseFareMinor: cents.optional(), perKmMinor: cents.optional(), perMinuteMinor: cents.optional(), minimumFareMinor: cents.optional(),
    bookingFeeMinor: cents.optional(), cancellationFeeMinor: cents.optional(),
    freeCancelWindowSeconds: z.number().int().min(0).max(3600).optional(),
    demandMultiplierBp: z.number().int().min(10_000, 'Demand multiplier cannot be below 1.00').max(50_000).optional(),
    roundingMinor: z.number().int().min(1).max(10_000).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 1, { message: 'Provide at least one value to change' });

export const ticketsQuerySchema = z.object({ status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(), ...page });
export const ticketIdParams = idParam('ticketId');
export const ticketStatusSchema = z.object({ status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']) }).strict();
export const reviewsQuerySchema = z.object({ rating: z.coerce.number().int().min(1).max(5).optional(), ...page });
export const auditQuerySchema = z.object({ action: z.string().trim().max(60).optional(), ...page });
export const analyticsQuerySchema = z.object({ days: z.coerce.number().int().min(7).max(90).default(14) });

export const paymentsQuerySchema = z.object({
  status: z.enum(['PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'REFUNDED']).optional(),
  method: z.enum(['CASH', 'CARD', 'DIGITAL_WALLET']).optional(), ...page,
});
export const settingsUpdateSchema = z
  .object({
    driverCommissionBp: z.number().int().min(0).max(5000), offerTtlSeconds: z.number().int().min(10).max(300),
    searchTimeoutSeconds: z.number().int().min(10).max(600), maxPickupRadiusMeters: z.number().int().min(1000).max(50_000),
  })
  .partial().strict().refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one setting to change' });
export const broadcastSchema = z.object({ audience: z.enum(['ALL', 'PASSENGER', 'DRIVER']), title: z.string().trim().min(3).max(80), body: z.string().trim().min(3).max(500) }).strict();
