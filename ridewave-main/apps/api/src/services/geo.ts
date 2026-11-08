// Demonstration service area (greater Johannesburg / Gauteng). Configurable per city in a later phase.
const AREA = { minLat: -26.55, maxLat: -25.6, minLng: 27.6, maxLng: 28.5 };
export const inServiceArea = (p: { lat: number; lng: number }) => p.lat >= AREA.minLat && p.lat <= AREA.maxLat && p.lng >= AREA.minLng && p.lng <= AREA.maxLng;
