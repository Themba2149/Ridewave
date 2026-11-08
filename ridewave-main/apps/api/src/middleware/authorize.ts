import type { RequestHandler } from 'express';
import type { Role } from '../types/auth';
import { AppError } from '../utils/errors';

/** Use after authenticate. Rejects users whose database role is not in the allowed list. */
export const authorize = (...roles: Role[]): RequestHandler => (req, _res, next) => {
  if (!req.auth) return next(AppError.unauthenticated());
  if (!roles.includes(req.auth.user.role)) return next(AppError.forbidden());
  next();
};
