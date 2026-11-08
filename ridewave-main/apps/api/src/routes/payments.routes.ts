import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import * as payments from '../services/payment.service';
import { asyncHandler } from '../utils/async-handler';
import { checkoutSchema, paymentIdParams } from '../validators/payment.validators';

export const paymentsRouter = Router();
paymentsRouter.use(authenticate);

paymentsRouter.post('/checkout', authorize('PASSENGER'), validate({ body: checkoutSchema }), asyncHandler(async (req, res) => {
  const result = await payments.checkout(req.auth!.user, req.body);
  res.status(result.duplicate ? 200 : 201).json({ success: true, data: result });
}));
paymentsRouter.get('/:paymentId', validate({ params: paymentIdParams }), asyncHandler(async (req, res) => {
  res.json({ success: true, data: { payment: await payments.getPayment(req.auth!.user, req.params.paymentId as string) } });
}));
