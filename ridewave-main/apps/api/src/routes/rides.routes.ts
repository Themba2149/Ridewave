import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import * as driverRides from '../services/driver-ride.service';
import * as payments from '../services/payment.service';
import * as rides from '../services/ride.service';
import { asyncHandler } from '../utils/async-handler';
import { cancelSchema, createRideSchema, estimateSchema, reviewSchema, rideParamsSchema } from '../validators/ride.validators';

export const ridesRouter = Router();
ridesRouter.use(authenticate);

ridesRouter.post('/estimate', authorize('PASSENGER'), validate({ body: estimateSchema }), asyncHandler(async (req, res) => {
  const { pickup, dropoff } = req.body;
  res.json({ success: true, data: await rides.estimateRides(pickup, dropoff) });
}));

ridesRouter.post('/', authorize('PASSENGER'), validate({ body: createRideSchema }), asyncHandler(async (req, res) => {
  const { id, created } = await rides.createRide(req.auth!.user, req.body);
  const ride = rides.toRideDto(await rides.getRideForUser(req.auth!.user, id));
  res.status(created ? 201 : 200).json({ success: true, data: { ride, duplicate: !created } });
}));

ridesRouter.get('/:rideId', validate({ params: rideParamsSchema }), asyncHandler(async (req, res) => {
  res.json({ success: true, data: { ride: await rides.getRideView(req.auth!.user, req.params.rideId as string) } });
}));

ridesRouter.post('/:rideId/retry', authorize('PASSENGER'), validate({ params: rideParamsSchema }), asyncHandler(async (req, res) => {
  res.json({ success: true, data: { ride: await rides.retryRide(req.auth!.user, req.params.rideId as string) } });
}));

// Driver actions: only the driver assigned to the ride can use these (anyone else gets 404).
const driverAction = (name: 'acceptRide' | 'arriveAtPickup' | 'startTrip' | 'completeTrip') =>
  asyncHandler(async (req, res) => { res.json({ success: true, data: { ride: await driverRides[name](req.auth!.user, req.params.rideId as string) } }); });
ridesRouter.post('/:rideId/accept', authorize('DRIVER'), validate({ params: rideParamsSchema }), driverAction('acceptRide'));
ridesRouter.post('/:rideId/decline', authorize('DRIVER'), validate({ params: rideParamsSchema }), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await driverRides.declineRide(req.auth!.user, req.params.rideId as string) });
}));
ridesRouter.post('/:rideId/arrive', authorize('DRIVER'), validate({ params: rideParamsSchema }), driverAction('arriveAtPickup'));
ridesRouter.post('/:rideId/start', authorize('DRIVER'), validate({ params: rideParamsSchema }), driverAction('startTrip'));
ridesRouter.post('/:rideId/complete', authorize('DRIVER'), validate({ params: rideParamsSchema }), driverAction('completeTrip'));

ridesRouter.post('/:rideId/cancel', authorize('PASSENGER'), validate({ params: rideParamsSchema, body: cancelSchema }), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await rides.cancelRide(req.auth!.user, req.params.rideId as string, req.body.reason) });
}));

ridesRouter.get('/:rideId/receipt', validate({ params: rideParamsSchema }), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await rides.getReceipt(req.auth!.user, req.params.rideId as string) });
}));

ridesRouter.post('/:rideId/reviews', authorize('PASSENGER'), validate({ params: rideParamsSchema, body: reviewSchema }), asyncHandler(async (req, res) => {
  await rides.submitReview(req.auth!.user, req.params.rideId as string, req.body);
  res.status(201).json({ success: true, data: { message: 'Thanks for your feedback.' } });
}));

ridesRouter.post('/:rideId/cash-received', authorize('DRIVER'), validate({ params: rideParamsSchema }), asyncHandler(async (req, res) => {
  res.json({ success: true, data: { payment: await payments.confirmCash(req.auth!.user, req.params.rideId as string) } });
}));
