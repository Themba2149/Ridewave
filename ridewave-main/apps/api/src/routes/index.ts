import { Router } from 'express';
import { adminRouter } from './admin.routes';
import { authRouter } from './auth.routes';
import { healthRouter } from './health.routes';
import { notificationsRouter } from './notifications.routes';
import { paymentsRouter } from './payments.routes';
import { placesRouter } from './places.routes';
import { driversRouter, passengersRouter } from './profiles.routes';
import { ridesRouter } from './rides.routes';
import { rideCategoriesRouter } from './ride-categories.routes';
import { supportRouter } from './support.routes';
import { usersRouter } from './users.routes';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/passengers', passengersRouter);
apiRouter.use('/drivers', driversRouter);
apiRouter.use('/admin', adminRouter);
apiRouter.use('/rides', ridesRouter);
apiRouter.use('/places', placesRouter);
apiRouter.use('/payments', paymentsRouter);
apiRouter.use('/notifications', notificationsRouter);
apiRouter.use('/ride-categories', rideCategoriesRouter);
apiRouter.use('/support', supportRouter);
