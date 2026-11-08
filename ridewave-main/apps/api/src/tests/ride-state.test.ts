import { describe, expect, it } from 'vitest';
import { ACTIVE_STATUSES, assertTransition, canTransition, PASSENGER_CANCELLABLE, TRANSITIONS } from '../services/ride-state';
import { devMapProvider, haversineMeters, SAMPLE_PLACES } from '../providers/dev-map-provider';

describe('ride state machine', () => {
  it('allows the happy path', () => {
    const path = ['REQUESTED', 'SEARCHING_FOR_DRIVER', 'DRIVER_ASSIGNED', 'DRIVER_ARRIVING', 'DRIVER_ARRIVED', 'IN_PROGRESS', 'COMPLETED'] as const;
    for (let i = 0; i < path.length - 1; i++) expect(canTransition(path[i]!, path[i + 1]!)).toBe(true);
  });
  it('treats COMPLETED and CANCELLED as final', () => {
    expect(TRANSITIONS.COMPLETED).toHaveLength(0);
    expect(TRANSITIONS.CANCELLED).toHaveLength(0);
    expect(() => assertTransition('COMPLETED', 'IN_PROGRESS')).toThrow(/cannot become/);
    expect(() => assertTransition('COMPLETED', 'COMPLETED')).toThrow();
  });
  it('rejects skipping steps and cancelling a trip in progress', () => {
    expect(canTransition('REQUESTED', 'IN_PROGRESS')).toBe(false);
    expect(canTransition('SEARCHING_FOR_DRIVER', 'COMPLETED')).toBe(false);
    expect(canTransition('IN_PROGRESS', 'CANCELLED')).toBe(false);
    expect(PASSENGER_CANCELLABLE).not.toContain('IN_PROGRESS');
  });
  it('every passenger-cancellable status can actually move to CANCELLED', () => {
    for (const s of PASSENGER_CANCELLABLE) expect(canTransition(s, 'CANCELLED')).toBe(true);
  });
  it('keeps NO_DRIVER_AVAILABLE out of the active set so the passenger can rebook or retry', () => {
    expect(ACTIVE_STATUSES).not.toContain('NO_DRIVER_AVAILABLE');
  });
});

describe('development map provider', () => {
  const [a, b] = [SAMPLE_PLACES[0]!, SAMPLE_PLACES[3]!];
  it('is clearly not live', () => {
    expect(devMapProvider.isLive).toBe(false);
    expect(devMapProvider.id).toBe('dev-sample');
  });
  it('is deterministic and symmetric', async () => {
    const x = await devMapProvider.estimateRoute(a, b);
    const y = await devMapProvider.estimateRoute(b, a);
    expect(x).toEqual(y);
    expect(x.distanceMeters).toBeGreaterThan(haversineMeters(a, b)); // roads are longer than straight lines
    expect(Number.isInteger(x.durationSeconds)).toBe(true);
  });
  it('searches by name case-insensitively and returns suggestions when the query is empty', async () => {
    expect((await devMapProvider.searchPlaces('SANDTON')).map((p) => p.id)).toContain('sandton-city');
    expect((await devMapProvider.searchPlaces('')).length).toBeGreaterThan(0);
    expect(await devMapProvider.searchPlaces('zzzzzz')).toEqual([]);
  });
});
