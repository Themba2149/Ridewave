import { Router } from 'express';
import { env } from '../config/env';
import { authenticate } from '../middleware/authenticate';
import { authLimiter } from '../middleware/rate-limit';
import { validate } from '../middleware/validate';
import { authRepository as repo } from '../repositories/auth.repository';
import * as auth from '../services/auth.service';
import { asyncHandler } from '../utils/async-handler';
import { clearAuthCookies, setAuthCookies } from '../utils/cookies';
import { newToken } from '../utils/tokens';
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema, type RegisterInput } from '../validators/auth.validators';

export const authRouter = Router();
const clientInfo = (req: import('express').Request) => ({ userAgent: req.get('user-agent')?.slice(0, 255), ipAddress: req.ip });

authRouter.post('/register', authLimiter, validate({ body: registerSchema }), asyncHandler(async (req, res) => {
  const { user, token } = await auth.registerUser(req.body as RegisterInput, clientInfo(req));
  setAuthCookies(res, token, newToken());
  res.status(201).json({ success: true, data: { user } });
}));

authRouter.post('/login', authLimiter, validate({ body: loginSchema }), asyncHandler(async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };
  const { user, token } = await auth.loginUser(email, password, clientInfo(req));
  setAuthCookies(res, token, newToken());
  res.json({ success: true, data: { user } });
}));

authRouter.post('/logout', authenticate, asyncHandler(async (req, res) => {
  await auth.logoutSession(req.auth!.sessionId, req.auth!.user.id);
  clearAuthCookies(res);
  res.json({ success: true, data: { loggedOut: true } });
}));

authRouter.get('/me', authenticate, asyncHandler(async (req, res) => {
  const user = auth.toPublicUser(req.auth!.user);
  const driver = user.role === 'DRIVER' ? await repo.getDriverProfile(user.id) : null;
  res.json({ success: true, data: { user, driver: driver && { approvalStatus: driver.approvalStatus, isOnline: driver.isOnline } } });
}));

authRouter.post('/forgot-password', authLimiter, validate({ body: forgotPasswordSchema }), asyncHandler(async (req, res) => {
  const result = await auth.requestPasswordReset((req.body as { email: string }).email);
  const data: Record<string, unknown> = { message: 'If an account exists for that email, a reset link has been prepared.' };
  // Development only: no email is sent, so the link is returned directly. Never exposed in production.
  // (Side effect, development only: this reveals whether the email is registered.)
  if (result && env.NODE_ENV !== 'production') {
    data.devResetPath = `/reset-password?token=${result.token}`;
    data.message = 'Development mode: no email was sent. Use the link below to reset your password.';
  }
  res.json({ success: true, data });
}));

authRouter.post('/reset-password', authLimiter, validate({ body: resetPasswordSchema }), asyncHandler(async (req, res) => {
  const { token, password } = req.body as { token: string; password: string };
  await auth.resetPassword(token, password);
  res.json({ success: true, data: { message: 'Password updated. You can now sign in.' } });
}));
