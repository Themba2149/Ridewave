import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { adminRepository as repo } from '../repositories/admin.repository';
import { authRepository as users } from '../repositories/auth.repository';
import { paymentsRepository as paymentsRepo } from '../repositories/payments.repository';
import * as admin from '../services/admin.service';
import * as notifications from '../services/notifications.service';
import * as settings from '../services/settings.service';
import { asyncHandler } from '../utils/async-handler';
import { AppError } from '../utils/errors';
import * as v from '../validators/admin.validators';

export const adminRouter = Router();
// Every admin endpoint is guarded here on the server, regardless of what the frontend shows.
adminRouter.use(authenticate, authorize('ADMIN'));

const ctx = (req: Request) => ({ actor: req.auth!.user, ip: req.ip });
const q = <T>(req: Request) => req.query as unknown as T;
const ok = (res: Response, data: unknown, status = 200) => res.status(status).json({ success: true, data });
const paged = <T>(r: { items: T[]; total: number }, page: number, pageSize: number) => ({ items: r.items, total: r.total, page, pageSize });

adminRouter.get('/analytics', validate({ query: v.analyticsQuerySchema }), asyncHandler(async (req, res) => ok(res, await admin.getAnalytics(q<{ days: number }>(req).days))));

// users
adminRouter.get('/users', validate({ query: v.adminUsersQuerySchema }), asyncHandler(async (req, res) => {
  const a = q<Parameters<typeof users.listUsers>[0]>(req);
  ok(res, paged(await users.listUsers(a), a.page, a.pageSize));
}));
adminRouter.patch('/users/:userId/status', validate({ params: v.userIdParams, body: v.userStatusSchema }), asyncHandler(async (req, res) =>
  ok(res, { user: await admin.setUserStatus(ctx(req), req.params.userId as string, req.body) })));

// drivers, documents, vehicles
adminRouter.get('/drivers', validate({ query: v.driversQuerySchema }), asyncHandler(async (req, res) => {
  const a = q<{ approval?: string; search?: string; page: number; pageSize: number }>(req);
  ok(res, paged(await repo.listDrivers(a), a.page, a.pageSize));
}));
adminRouter.get('/drivers/:driverId', validate({ params: v.driverIdParams }), asyncHandler(async (req, res) => {
  const d = await repo.getDriver(req.params.driverId as string);
  if (!d) throw AppError.notFound('Driver not found.');
  ok(res, { driver: d });
}));
adminRouter.patch('/drivers/:driverId/approval', validate({ params: v.driverIdParams, body: v.driverApprovalSchema }), asyncHandler(async (req, res) =>
  ok(res, { driver: await admin.setDriverApproval(ctx(req), req.params.driverId as string, req.body) })));

adminRouter.get('/documents/:documentId/download', validate({ params: v.documentIdParams }), asyncHandler(async (req, res, next) => {
  const { doc, stream } = await admin.openDocumentForReview(ctx(req), req.params.documentId as string);
  res.setHeader('Content-Type', doc.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${doc.type.toLowerCase()}-${doc.id}.${doc.storageKey.split('.').pop()}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');
  stream.on('error', next).pipe(res);
}));
adminRouter.patch('/documents/:documentId', validate({ params: v.documentIdParams, body: v.documentReviewSchema }), asyncHandler(async (req, res) =>
  ok(res, { document: await admin.reviewDocument(ctx(req), req.params.documentId as string, req.body) })));

adminRouter.get('/vehicles', validate({ query: v.vehiclesQuerySchema }), asyncHandler(async (req, res) => {
  const a = q<{ search?: string; active?: 'true' | 'false'; page: number; pageSize: number }>(req);
  ok(res, paged(await repo.listVehicles({ search: a.search, active: a.active === undefined ? undefined : a.active === 'true', page: a.page, pageSize: a.pageSize }), a.page, a.pageSize));
}));
adminRouter.patch('/vehicles/:vehicleId', validate({ params: v.vehicleIdParams, body: v.vehicleActiveSchema }), asyncHandler(async (req, res) =>
  ok(res, { vehicle: await admin.setVehicleActive(ctx(req), req.params.vehicleId as string, req.body.isActive) })));

// rides
adminRouter.get('/rides', validate({ query: v.adminRidesQuerySchema }), asyncHandler(async (req, res) => {
  const a = q<Parameters<typeof repo.listRides>[0]>(req);
  ok(res, paged(await repo.listRides(a), a.page, a.pageSize));
}));
adminRouter.post('/rides/:rideId/cancel', validate({ params: v.adminRideIdParams, body: v.adminCancelSchema }), asyncHandler(async (req, res) =>
  ok(res, { ride: await admin.cancelRideAsAdmin(ctx(req), req.params.rideId as string, req.body.reason) })));

// categories and pricing
adminRouter.get('/categories', asyncHandler(async (_req, res) => ok(res, { items: await repo.listCategories() })));
adminRouter.patch('/categories/:categoryId', validate({ params: v.categoryIdParams, body: v.categoryUpdateSchema }), asyncHandler(async (req, res) =>
  ok(res, { category: await admin.updateCategory(ctx(req), req.params.categoryId as string, req.body) })));
adminRouter.get('/pricing', asyncHandler(async (_req, res) => ok(res, { items: await repo.listPricing() })));
adminRouter.patch('/pricing', validate({ body: v.pricingUpdateSchema }), asyncHandler(async (req, res) => ok(res, { pricing: await admin.updatePricing(ctx(req), req.body) })));

// support, reviews, audit
adminRouter.get('/support-tickets', validate({ query: v.ticketsQuerySchema }), asyncHandler(async (req, res) => {
  const a = q<{ status?: string; page: number; pageSize: number }>(req);
  ok(res, paged(await repo.listTickets(a), a.page, a.pageSize));
}));
adminRouter.patch('/support-tickets/:ticketId', validate({ params: v.ticketIdParams, body: v.ticketStatusSchema }), asyncHandler(async (req, res) =>
  ok(res, { ticket: await admin.setTicketStatus(ctx(req), req.params.ticketId as string, req.body.status) })));
adminRouter.get('/reviews', validate({ query: v.reviewsQuerySchema }), asyncHandler(async (req, res) => {
  const a = q<{ rating?: number; page: number; pageSize: number }>(req);
  ok(res, paged(await repo.listReviews(a), a.page, a.pageSize));
}));
adminRouter.get('/audit-logs', validate({ query: v.auditQuerySchema }), asyncHandler(async (req, res) => {
  const a = q<{ action?: string; page: number; pageSize: number }>(req);
  ok(res, paged(await repo.listAudit(a), a.page, a.pageSize));
}));

// payments (simulated in development), platform settings, announcements
adminRouter.get('/payments', validate({ query: v.paymentsQuerySchema }), asyncHandler(async (req, res) => {
  const a = q<Parameters<typeof paymentsRepo.listAll>[0]>(req);
  const [list, summary] = await Promise.all([paymentsRepo.listAll(a), paymentsRepo.summary()]);
  ok(res, { ...paged(list, a.page, a.pageSize), summary, note: 'Payments in this build use a simulated provider. No real money has moved.' });
}));
adminRouter.get('/settings', asyncHandler(async (_req, res) => ok(res, await settings.getSettings())));
adminRouter.patch('/settings', validate({ body: v.settingsUpdateSchema }), asyncHandler(async (req, res) => ok(res, await settings.updateSettings(req.auth!.user.id, req.body, req.ip))));
adminRouter.post('/notifications', validate({ body: v.broadcastSchema }), asyncHandler(async (req, res) => {
  const sent = await notifications.broadcast(req.body.audience, { title: req.body.title, body: req.body.body });
  await repo.recordAudit({ actorId: req.auth!.user.id, action: 'ANNOUNCEMENT_SENT', entityType: 'Notification', metadata: { audience: req.body.audience, title: req.body.title, recipients: sent }, ipAddress: req.ip ?? null });
  ok(res, { sent }, 201);
}));
