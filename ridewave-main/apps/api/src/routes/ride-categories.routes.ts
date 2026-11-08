import { Router } from 'express';
import { prisma } from '../config/database';
import { asyncHandler } from '../utils/async-handler';

export const rideCategoriesRouter = Router();

type CategoryRow = {
  code: string; name: string; description: string; capacity: number; luggageNote: string | null;
  fareConfigurations: Array<{ currency: string; baseFareMinor: number; perKmMinor: number; perMinuteMinor: number; minimumFareMinor: number; bookingFeeMinor: number }>;
};

// Public list of active ride categories with the active Johannesburg demonstration rates (minor units).
rideCategoriesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const categories = await prisma.rideCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: { fareConfigurations: { where: { isActive: true, cityCode: 'JNB' }, take: 1 } },
    });
    const data = (categories as CategoryRow[]).flatMap((c) => {
      const f = c.fareConfigurations[0];
      if (!f) return [];
      return [
        {
          code: c.code,
          name: c.name,
          description: c.description,
          capacity: c.capacity,
          luggageNote: c.luggageNote,
          currency: f.currency,
          baseFareMinor: f.baseFareMinor,
          perKmMinor: f.perKmMinor,
          perMinuteMinor: f.perMinuteMinor,
          minimumFareMinor: f.minimumFareMinor,
          bookingFeeMinor: f.bookingFeeMinor,
        },
      ];
    });
    res.json({ success: true, data });
  }),
);
