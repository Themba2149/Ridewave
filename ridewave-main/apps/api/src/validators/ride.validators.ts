import { z } from 'zod';

const place = z.object({
  address: z.string().trim().min(3).max(200),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
}).strict();

export const estimateSchema = z.object({ pickup: place, dropoff: place }).strict();
// The client never sends a fare, distance or duration: the server derives them. strict() rejects attempts to include one.
export const createRideSchema = z.object({
  pickup: place, dropoff: place,
  categoryCode: z.string().trim().min(1).max(30),
  idempotencyKey: z.string().trim().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/),
}).strict();
export const cancelSchema = z.object({ reason: z.string().trim().max(200).optional() }).strict();
export const reviewSchema = z.object({ rating: z.number().int().min(1).max(5), comment: z.string().trim().max(500).optional() }).strict();
export const rideParamsSchema = z.object({ rideId: z.string().min(1).max(64) });
export const placesQuerySchema = z.object({ q: z.string().trim().max(100).default('') });
export const myRidesQuerySchema = z.object({
  scope: z.enum(['active', 'past', 'all']).default('all'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});
export const savedLocationSchema = z.object({
  label: z.string().trim().min(1).max(50),
  address: z.string().trim().min(3).max(200),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  isFavorite: z.boolean().default(false),
}).strict();
export const savedLocationParamsSchema = z.object({ locationId: z.string().min(1).max(64) });

export const availabilitySchema = z.object({
  isOnline: z.boolean(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
}).strict().refine((v) => (v.lat === undefined) === (v.lng === undefined), { message: 'Provide both lat and lng, or neither' });
export const vehicleSchema = z.object({
  categoryCode: z.string().trim().min(1).max(30),
  make: z.string().trim().min(2).max(40),
  model: z.string().trim().min(1).max(40),
  year: z.number().int().min(1995).max(new Date().getFullYear() + 1),
  colour: z.string().trim().min(2).max(30),
  registration: z.string().trim().min(3).max(15),
  passengerCapacity: z.number().int().min(2).max(10),
}).strict();
export const earningsQuerySchema = z.object({ period: z.enum(['day', 'week', 'month']).default('day') });
