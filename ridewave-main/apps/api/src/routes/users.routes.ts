import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import * as auth from '../services/auth.service';
import { asyncHandler } from '../utils/async-handler';
import { changePasswordSchema, updateProfileSchema } from '../validators/auth.validators';

export const usersRouter = Router();
usersRouter.use(authenticate);

usersRouter.patch('/me', validate({ body: updateProfileSchema }), asyncHandler(async (req, res) => {
  const user = await auth.updateProfile(req.auth!.user.id, req.body as { fullName?: string; phone?: string | null });
  res.json({ success: true, data: { user } });
}));

usersRouter.post('/me/change-password', validate({ body: changePasswordSchema }), asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
  await auth.changePassword(req.auth!.user, req.auth!.sessionId, currentPassword, newPassword);
  res.json({ success: true, data: { message: 'Password changed. Other devices have been signed out.' } });
}));
