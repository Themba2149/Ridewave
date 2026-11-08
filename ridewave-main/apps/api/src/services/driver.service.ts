import { getMapProvider } from '../providers/map-provider';
import { driversRepository as drivers, type DriverContext } from '../repositories/drivers.repository';
import { ridesRepository as rides } from '../repositories/rides.repository';
import type { UserRecord } from '../types/auth';
import { AppError } from '../utils/errors';
import { matchWaitingRides, refreshRide } from './matching.service';
import { getSettings } from './settings.service';
import { inServiceArea } from './geo';

const SAST_OFFSET_MS = 2 * 3600_000; // South Africa has no daylight saving: fixed UTC+2
const DAY_MS = 86_400_000;

export async function requireDriver(user: UserRecord): Promise<DriverContext> {
  const ctx = await drivers.getContext(user.id);
  if (!ctx) throw AppError.forbidden('Only drivers can do that.');
  return ctx;
}

export async function setAvailability(user: UserRecord, input: { isOnline: boolean; lat?: number; lng?: number }) {
  const ctx = await requireDriver(user);
  if (input.isOnline) {
    if (ctx.approvalStatus !== 'APPROVED') throw AppError.invalidState('Your driver account must be approved before you can go online.');
    if (ctx.activeVehicleCount === 0) throw AppError.invalidState('Add an active vehicle before going online.');
    const location = input.lat !== undefined && input.lng !== undefined ? { lat: input.lat, lng: input.lng } : ctx.lat !== null && ctx.lng !== null ? { lat: ctx.lat, lng: ctx.lng } : null;
    if (!location) throw AppError.validation('Choose your current location before going online.');
    if (!inServiceArea(location)) throw AppError.validation('Your location is outside the Johannesburg service area.');
    await drivers.setAvailability(ctx.id, { isOnline: true, lat: location.lat, lng: location.lng });
    await matchWaitingRides(); // offer this driver to rides that were already waiting
  } else {
    if (await drivers.hasActiveRide(ctx.id)) throw AppError.invalidState('Respond to or finish your current ride before going offline.');
    await drivers.setAvailability(ctx.id, { isOnline: false });
  }
  return { isOnline: input.isOnline };
}

export async function listRequests(user: UserRecord) {
  const ctx = await requireDriver(user);
  const rideId = await drivers.findCurrentOfferRideId(ctx.id);
  if (rideId) await refreshRide(rideId); // expires the offer if the driver took too long
  const current = await drivers.findCurrentOfferRideId(ctx.id);
  if (!current) return { items: [] };
  const ride = await rides.getRideDetail(current);
  if (!ride || ride.driverUserId !== user.id || !ride.assignedAt) return { items: [] };
  const settings = await getSettings();
  const pickupEta = ctx.lat !== null && ctx.lng !== null ? await getMapProvider().estimateRoute({ lat: ctx.lat, lng: ctx.lng }, ride.pickup) : null;
  return {
    items: [{
      rideId: ride.id, passengerFirstName: ride.passengerFirstName, category: ride.category.name, pickup: ride.pickup, dropoff: ride.dropoff,
      distanceMeters: ride.distanceMeters, durationSeconds: ride.durationSeconds, estimatedFareMinor: ride.estimatedFareMinor,
      estimatedEarningsMinor: netEarnings(ride.estimatedFareMinor, settings.values.driverCommissionBp), pickupEtaSeconds: pickupEta?.durationSeconds ?? null,
      offerExpiresAt: new Date(ride.assignedAt.getTime() + settings.values.offerTtlSeconds * 1000),
    }],
  };
}

export const netEarnings = (grossMinor: number, commissionBp: number) => Math.floor((grossMinor * (10_000 - commissionBp)) / 10_000);

export async function addVehicle(user: UserRecord, input: { categoryCode: string; make: string; model: string; year: number; colour: string; registration: string; passengerCapacity: number }) {
  const ctx = await requireDriver(user);
  const category = await rides.findCategoryWithFare(input.categoryCode);
  if (!category) throw AppError.validation('That ride category is not available.');
  if (input.passengerCapacity < category.capacity) throw AppError.validation(`${category.name} needs a vehicle with at least ${category.capacity} passenger seats.`);
  const { categoryCode: _c, ...rest } = input;
  void _c;
  return drivers.createVehicle(ctx.id, { ...rest, registration: rest.registration.toUpperCase().replace(/\s+/g, ''), categoryId: category.id });
}

// ---- earnings ----
const startOfDay = (now: number) => Math.floor((now + SAST_OFFSET_MS) / DAY_MS) * DAY_MS - SAST_OFFSET_MS;
export function periodStart(period: 'day' | 'week' | 'month', now = Date.now()): number {
  if (period === 'day') return startOfDay(now);
  if (period === 'week') return startOfDay(now) - ((new Date(now + SAST_OFFSET_MS).getUTCDay() + 6) % 7) * DAY_MS; // week starts Monday
  const d = new Date(now + SAST_OFFSET_MS);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) - SAST_OFFSET_MS;
}
const localDate = (ms: number) => new Date(ms + SAST_OFFSET_MS).toISOString().slice(0, 10);

export async function getEarnings(user: UserRecord, period: 'day' | 'week' | 'month', now = Date.now()) {
  const ctx = await requireDriver(user);
  const settings = await getSettings();
  const bp = settings.values.driverCommissionBp;
  const start = periodStart(period, now);
  const [completed, responses, completedAllTime] = await Promise.all([drivers.listCompletedSince(ctx.id, new Date(start)), drivers.countResponses(user.id), drivers.countCompleted(ctx.id)]);

  const byDay = new Map<string, { trips: number; grossMinor: number }>();
  for (let t = start; t <= now; t += DAY_MS) byDay.set(localDate(t), { trips: 0, grossMinor: 0 });
  for (const r of completed) {
    const row = byDay.get(localDate(r.completedAt.getTime())) ?? { trips: 0, grossMinor: 0 };
    row.trips += 1; row.grossMinor += r.finalFareMinor;
    byDay.set(localDate(r.completedAt.getTime()), row);
  }
  const grossMinor = completed.reduce((s, r) => s + r.finalFareMinor, 0);
  const offers = responses.accepted + responses.declined;
  return {
    period, since: new Date(start), currency: 'ZAR',
    trips: completed.length, grossMinor, commissionMinor: grossMinor - netEarnings(grossMinor, bp), netMinor: netEarnings(grossMinor, bp),
    commission: { rateBp: bp, isDemonstrationRate: !settings.overridden.includes('driverCommissionBp') },
    daily: [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, trips: v.trips, grossMinor: v.grossMinor, netMinor: netEarnings(v.grossMinor, bp) })),
    stats: { completedTripsAllTime: completedAllTime, offersAccepted: responses.accepted, offersDeclined: responses.declined, acceptanceRatePercent: offers === 0 ? null : Math.round((responses.accepted / offers) * 100) },
  };
}
