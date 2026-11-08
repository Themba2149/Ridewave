import { env } from '../config/env';
import { devMapProvider, type MapProvider } from './dev-map-provider';

/** Swap the implementation here when a live provider (Mapbox, Google Maps) is added. The booking code only sees MapProvider. */
export function getMapProvider(): MapProvider {
  if (env.MAP_PROVIDER === 'dev') return devMapProvider;
  throw new Error(`MAP_PROVIDER=${env.MAP_PROVIDER} is not implemented yet. Set MAP_PROVIDER=dev in .env.`);
}
