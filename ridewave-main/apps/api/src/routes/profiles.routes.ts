import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { uploadLimiter } from '../middleware/rate-limit';
import { singleFileUpload } from '../middleware/upload';
import { validate } from '../middleware/validate';
import { authRepository as repo } from '../repositories/auth.repository';
import { driversRepository } from '../repositories/drivers.repository';
import { toPublicUser } from '../services/auth.service';
import * as driverRides from '../services/driver-ride.service';
import * as driverDocs from '../services/driver-documents.service';
import * as driver from '../services/driver.service';
import * as payments from '../services/payment.service';
import * as rides from '../services/ride.service';
import { asyncHandler } from '../utils/async-handler';
import { AppError } from '../utils/errors';
import { documentIdParams, documentUploadSchema } from '../validators/admin.validators';
import { paymentMethodParams, paymentMethodSchema } from '../validators/payment.validators';
import { availabilitySchema, earningsQuerySchema, myRidesQuerySchema, savedLocationParamsSchema, savedLocationSchema, vehicleSchema } from '../validators/ride.validators';

// Each handler loads data by the authenticated user's id only: there is no user id in the URL to tamper with.
export const passengersRouter = Router();
passengersRouter.use(authenticate, authorize('PASSENGER'));

passengersRouter.get('/me', asyncHandler(async (req, res) => {
  const profile = await repo.getPassengerProfile(req.auth!.user.id);
  if (!profile) throw AppError.notFound('Passenger profile not found.');
  res.json({ success: true, data: { user: toPublicUser(req.auth!.user), profile } });
}));

passengersRouter.get('/me/rides', validate({ query: myRidesQuerySchema }), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await rides.listMyRides(req.auth!.user, req.query as never) });
}));

passengersRouter.get('/me/saved-locations', asyncHandler(async (req, res) => {
  res.json({ success: true, data: { items: await rides.listSavedLocations(req.auth!.user) } });
}));
passengersRouter.post('/me/saved-locations', validate({ body: savedLocationSchema }), asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: { location: await rides.createSavedLocation(req.auth!.user, req.body) } });
}));
passengersRouter.delete('/me/saved-locations/:locationId', validate({ params: savedLocationParamsSchema }), asyncHandler(async (req, res) => {
  await rides.deleteSavedLocation(req.auth!.user, req.params.locationId as string);
  res.json({ success: true, data: { deleted: true } });
}));

passengersRouter.get('/me/payment-methods', asyncHandler(async (req, res) => {
  res.json({ success: true, data: { items: await payments.listMethods(req.auth!.user) } });
}));
passengersRouter.post('/me/payment-methods', validate({ body: paymentMethodSchema }), asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: { method: await payments.addMethod(req.auth!.user, req.body) } });
}));
passengersRouter.patch('/me/payment-methods/:methodId/default', validate({ params: paymentMethodParams }), asyncHandler(async (req, res) => {
  await payments.makeDefaultMethod(req.auth!.user, req.params.methodId as string);
  res.json({ success: true, data: { updated: true } });
}));
passengersRouter.delete('/me/payment-methods/:methodId', validate({ params: paymentMethodParams }), asyncHandler(async (req, res) => {
  await payments.removeMethod(req.auth!.user, req.params.methodId as string);
  res.json({ success: true, data: { deleted: true } });
}));

export const driversRouter = Router();
driversRouter.use(authenticate, authorize('DRIVER'));

driversRouter.get('/me', asyncHandler(async (req, res) => {
  const profile = await repo.getDriverProfile(req.auth!.user.id);
  if (!profile) throw AppError.notFound('Driver profile not found.');
  const { currentLat, currentLng, ...rest } = profile;
  res.json({ success: true, data: { user: toPublicUser(req.auth!.user), profile: { ...rest, location: currentLat !== null && currentLng !== null ? { lat: currentLat, lng: currentLng } : null } } });
}));

driversRouter.patch('/me/availability', validate({ body: availabilitySchema }), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await driver.setAvailability(req.auth!.user, req.body) });
}));
driversRouter.get('/me/ride-requests', asyncHandler(async (req, res) => {
  res.json({ success: true, data: await driver.listRequests(req.auth!.user) });
}));
driversRouter.get('/me/rides', validate({ query: myRidesQuerySchema }), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await driverRides.listDriverRides(req.auth!.user, req.query as never) });
}));
driversRouter.get('/me/earnings', validate({ query: earningsQuerySchema }), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await driver.getEarnings(req.auth!.user, (req.query as unknown as { period: 'day' | 'week' | 'month' }).period) });
}));
driversRouter.get('/me/vehicles', asyncHandler(async (req, res) => {
  const ctx = await driver.requireDriver(req.auth!.user);
  res.json({ success: true, data: { items: await driversRepository.listVehicles(ctx.id) } });
}));
driversRouter.post('/me/vehicles', validate({ body: vehicleSchema }), asyncHandler(async (req, res) => {
  res.status(201).json({ success: true, data: { vehicle: await driver.addVehicle(req.auth!.user, req.body) } });
}));

// Driver documents: private files. Uploads are validated by content and stored outside any public folder.
driversRouter.get('/me/documents', asyncHandler(async (req, res) => {
  res.json({ success: true, data: { items: await driverDocs.listOwnDocuments(req.auth!.user) } });
}));
driversRouter.post('/me/documents', uploadLimiter, singleFileUpload, validate({ body: documentUploadSchema }), asyncHandler(async (req, res) => {
  const document = await driverDocs.uploadDocument(req.auth!.user, { type: req.body.type, file: req.file });
  res.status(201).json({ success: true, data: { document } });
}));
driversRouter.get('/me/documents/:documentId/download', validate({ params: documentIdParams }), asyncHandler(async (req, res, next) => {
  const { doc, stream } = await driverDocs.openOwnDocument(req.auth!.user, req.params.documentId as string);
  res.setHeader('Content-Type', doc.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${doc.type.toLowerCase()}-${doc.id}.${doc.storageKey.split('.').pop()}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');
  stream.on('error', next).pipe(res);
}));
