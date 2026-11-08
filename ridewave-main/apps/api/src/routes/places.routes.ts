import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { getMapProvider } from '../providers/map-provider';
import { asyncHandler } from '../utils/async-handler';
import { placesQuerySchema } from '../validators/ride.validators';

export const placesRouter = Router();

placesRouter.get('/search', authenticate, validate({ query: placesQuerySchema }), asyncHandler(async (req, res) => {
  const provider = getMapProvider();
  const places = await provider.searchPlaces((req.query as unknown as { q: string }).q);
  res.json({ success: true, data: { places, provider: { id: provider.id, isLive: provider.isLive } } });
}));
