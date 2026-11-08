import type { LatLng } from '../types/ride';

export type PlaceSuggestion = { id: string; name: string; address: string; lat: number; lng: number };
export type RouteEstimate = { distanceMeters: number; durationSeconds: number; source: string };

/** Everything the booking module needs from a mapping service. A Mapbox or Google adapter can implement this later. */
export interface MapProvider {
  readonly id: string;
  /** False for the development substitute: results are sample data, not live geographic data. */
  readonly isLive: boolean;
  searchPlaces(query: string): Promise<PlaceSuggestion[]>;
  estimateRoute(from: LatLng, to: LatLng): Promise<RouteEstimate>;
}

// Approximate coordinates of well-known Johannesburg-area landmarks, for DEVELOPMENT use only.
export const SAMPLE_PLACES: PlaceSuggestion[] = [
  { id: 'sandton-city', name: 'Sandton City', address: 'Sandton City, Rivonia Rd, Sandton', lat: -26.1076, lng: 28.0567 },
  { id: 'rosebank-mall', name: 'The Zone @ Rosebank', address: 'The Zone @ Rosebank, Oxford Rd, Rosebank', lat: -26.145, lng: 28.0408 },
  { id: 'melrose-arch', name: 'Melrose Arch', address: 'Melrose Arch, Melrose', lat: -26.1347, lng: 28.0687 },
  { id: 'or-tambo', name: 'OR Tambo International Airport', address: 'OR Tambo International Airport, Kempton Park', lat: -26.1337, lng: 28.242 },
  { id: 'park-station', name: 'Park Station', address: 'Park Station, Johannesburg CBD', lat: -26.1999, lng: 28.0415 },
  { id: 'maboneng', name: 'Maboneng Precinct', address: 'Maboneng Precinct, Fox St, Johannesburg', lat: -26.2043, lng: 28.06 },
  { id: 'wits', name: 'Wits University', address: 'University of the Witwatersrand, Braamfontein', lat: -26.1929, lng: 28.0305 },
  { id: 'gold-reef-city', name: 'Gold Reef City', address: 'Gold Reef City, Northern Parkway, Ormonde', lat: -26.235, lng: 28.0111 },
  { id: 'vilakazi', name: 'Vilakazi Street, Soweto', address: 'Vilakazi Street, Orlando West, Soweto', lat: -26.238, lng: 27.907 },
  { id: 'fourways-mall', name: 'Fourways Mall', address: 'Fourways Mall, Fourways', lat: -26.019, lng: 28.009 },
  { id: 'montecasino', name: 'Montecasino', address: 'Montecasino, Fourways', lat: -25.9966, lng: 28.0128 },
  { id: 'dainfern', name: 'Dainfern Square', address: 'Dainfern Square, Dainfern', lat: -25.9915, lng: 28.0054 },
];

const EARTH_RADIUS_M = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;

export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

const CIRCUITY = 1.35; // road distance is longer than a straight line
const URBAN_SPEED_MS = 30_000 / 3600; // 30 km/h average

export const devMapProvider: MapProvider = {
  id: 'dev-sample',
  isLive: false,
  async searchPlaces(query) {
    const q = query.trim().toLowerCase();
    const hits = q ? SAMPLE_PLACES.filter((p) => p.name.toLowerCase().includes(q) || p.address.toLowerCase().includes(q)) : SAMPLE_PLACES;
    return hits.slice(0, 8);
  },
  /** Deterministic estimate from straight-line distance. NOT real routing or live traffic. */
  async estimateRoute(from, to) {
    const distanceMeters = Math.round(haversineMeters(from, to) * CIRCUITY);
    return { distanceMeters, durationSeconds: Math.max(60, Math.round(distanceMeters / URBAN_SPEED_MS)), source: 'dev-sample' };
  },
};
