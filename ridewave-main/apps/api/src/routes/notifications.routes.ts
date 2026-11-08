import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import * as notifications from '../services/notifications.service';
import { asyncHandler } from '../utils/async-handler';
import { AppError } from '../utils/errors';
import { notificationParams, notificationsQuerySchema } from '../validators/payment.validators';

export const notificationsRouter = Router();
notificationsRouter.use(authenticate);

notificationsRouter.get('/', validate({ query: notificationsQuerySchema }), asyncHandler(async (req, res) => {
  const q = req.query as unknown as { page: number; pageSize: number; unread: 'true' | 'false' };
  const r = await notifications.listNotifications(req.auth!.user.id, { page: q.page, pageSize: q.pageSize, unreadOnly: q.unread === 'true' }); // only the caller's own
  res.json({ success: true, data: { ...r, page: q.page, pageSize: q.pageSize } });
}));
notificationsRouter.post('/read-all', asyncHandler(async (req, res) => {
  res.json({ success: true, data: { updated: await notifications.markAllNotificationsRead(req.auth!.user.id) } });
}));
notificationsRouter.post('/:notificationId/read', validate({ params: notificationParams }), asyncHandler(async (req, res) => {
  if (!(await notifications.markNotificationRead(req.auth!.user.id, req.params.notificationId as string))) throw AppError.notFound('Notification not found.');
  res.json({ success: true, data: { read: true } });
}));
