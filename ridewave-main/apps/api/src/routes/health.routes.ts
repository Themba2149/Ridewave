import { Router } from 'express';
import { env } from '../config/env';
import { prisma } from '../config/database';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  let database: 'up' | 'down' = 'up';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = 'down';
  }
  const ok = database === 'up';
  res.status(ok ? 200 : 503).json({
    success: ok,
    data: {
      status: ok ? 'ok' : 'degraded',
      service: 'ridewave-api',
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
      database,
      integrations: { maps: env.MAP_PROVIDER, payments: env.PAYMENT_PROVIDER, email: env.EMAIL_PROVIDER },
    },
  });
});
