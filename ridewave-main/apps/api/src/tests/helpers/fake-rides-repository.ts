import type { DocumentRow } from '../../types/admin';
import type { DriverContext, DriversRepository, DriverRideSummary, VehicleRow } from '../../repositories/drivers.repository';
import type { RidesRepository, SavedLocationRow } from '../../repositories/rides.repository';
import { ACTIVE_STATUSES } from '../../services/ride-state';
import type { Candidate, CategoryWithFare, MatchingInfo, RideDetail, RideSummary } from '../../types/ride';
import { AppError } from '../../utils/errors';

type History = RideDetail['statusHistory'][number] & { actorId?: string };
export type StoredRide = Omit<RideDetail, 'statusHistory'> & {
  passengerProfileId: string; idempotencyKey: string | null; reviewed: boolean; categoryId: string;
  driverProfileId: string | null; vehicleId: string | null; declinedBy: string[]; statusHistory: History[];
};
export type DriverState = {
  id: string; userId: string; name: string; approval: string; isOnline: boolean; lat: number | null; lng: number | null; userStatus: 'ACTIVE' | 'SUSPENDED';
  vehicles: Array<VehicleRow & { categoryId: string }>; approvalNote?: string | null;
};

/** In-memory stand-in for the Prisma rides + drivers repositories, sharing one set of data. passengerProfileId === `pp_<userId>`. */
export function createFakeWorld() {
  let seq = 0;
  const id = (p = 'x') => `${p}_${++seq}`;
  const rides: StoredRide[] = [];
  const saved: Array<SavedLocationRow & { passengerId: string }> = [];
  const reviews: Array<{ rideId: string; authorUserId: string; rating: number }> = [];
  const docs: DocumentRow[] = [];
  const hooks: { paymentFor: (rideId: string) => { method: string; status: string } | null } = { paymentFor: () => null }; // set by the payments fake
  const drivers = new Map<string, DriverState>(); // by user id
  const fare = { currency: 'ZAR', baseFareMinor: 1500, perKmMinor: 750, perMinuteMinor: 900, minimumFareMinor: 3000, bookingFeeMinor: 500, demandMultiplierBp: 10000, roundingMinor: 100, cancellationFeeMinor: 2000, freeCancelWindowSeconds: 120 };
  const categories: CategoryWithFare[] = [
    { id: 'c1', code: 'ECONOMY', name: 'RideWave Economy', description: 'd', capacity: 4, luggageNote: null, fare: { ...fare } },
    { id: 'c2', code: 'COMFORT', name: 'RideWave Comfort', description: 'd', capacity: 4, luggageNote: null, fare: { ...fare, baseFareMinor: 2000 } },
    { id: 'c3', code: 'XL', name: 'RideWave XL', description: 'd', capacity: 6, luggageNote: null, fare: { ...fare } },
  ];
  const byProfile = (pid: string) => [...drivers.values()].find((d) => d.id === pid);
  const isActive = (r: StoredRide) => ACTIVE_STATUSES.includes(r.status);
  const driverBusy = (pid: string) => rides.some((r) => r.driverProfileId === pid && isActive(r));

  function addDriver(userId: string, o: { name?: string; lat?: number; lng?: number; online?: boolean; approved?: boolean; categoryCode?: string; vehicle?: boolean; userStatus?: 'ACTIVE' | 'SUSPENDED' } = {}) {
    const cat = categories.find((c) => c.code === (o.categoryCode ?? 'ECONOMY'))!;
    const d: DriverState = {
      id: `dp_${userId}`, userId, name: o.name ?? 'Demo Driver', approval: o.approved === false ? 'PENDING' : 'APPROVED', isOnline: o.online ?? true,
      lat: o.lat ?? -26.1076, lng: o.lng ?? 28.0567, userStatus: o.userStatus ?? 'ACTIVE', vehicles: [],
    };
    if (o.vehicle !== false) d.vehicles.push({ id: id('v'), categoryId: cat.id, make: 'Toyota', model: 'Etios', year: 2019, colour: 'White', registration: `REG${seq}`, passengerCapacity: cat.capacity, isActive: true, category: { code: cat.code, name: cat.name } });
    drivers.set(userId, d);
    return d;
  }

  const ridesRepo: RidesRepository = {
    async listCategoriesWithFare() { return categories; },
    async findCategoryWithFare(code) { return categories.find((c) => c.code === code) ?? null; },
    async getPassengerProfileId(userId) { return `pp_${userId}`; },
    async findRideByIdempotencyKey(pid, key) { const r = rides.find((x) => x.passengerProfileId === pid && x.idempotencyKey === key); return r ? { id: r.id } : null; },
    async findActiveRideId(pid) { return rides.find((x) => x.passengerProfileId === pid && isActive(x))?.id ?? null; },
    async createRide(i) {
      const cat = categories.find((c) => c.id === i.categoryId)!;
      const now = new Date();
      const ride: StoredRide = {
        id: id('r'), status: 'SEARCHING_FOR_DRIVER', passengerUserId: i.passengerUserId, driverUserId: null, passengerFirstName: 'Pat', driverLocation: null,
        passengerProfileId: i.passengerProfileId, idempotencyKey: i.idempotencyKey, reviewed: false, categoryId: i.categoryId, driverProfileId: null, vehicleId: null, declinedBy: [],
        category: { code: cat.code, name: cat.name }, pickup: i.pickup, dropoff: i.dropoff, currency: i.currency, distanceMeters: i.distanceMeters, durationSeconds: i.durationSeconds,
        estimatedFareMinor: i.estimatedFareMinor, finalFareMinor: null, fareBreakdown: i.fareBreakdown, routeSource: i.routeSource,
        requestedAt: now, assignedAt: null, arrivedAt: null, startedAt: null, completedAt: null, cancelledAt: null, cancellationReason: null, cancelledBy: null,
        statusHistory: [
          { fromStatus: null, toStatus: 'REQUESTED', actorType: 'PASSENGER', actorId: i.passengerUserId, note: null, createdAt: now },
          { fromStatus: 'REQUESTED', toStatus: 'SEARCHING_FOR_DRIVER', actorType: 'SYSTEM', note: null, createdAt: now },
        ],
        driver: null, hasReview: false, cancellationPolicy: { feeMinor: fare.cancellationFeeMinor, freeWindowSeconds: fare.freeCancelWindowSeconds },
      };
      rides.push(ride);
      return { id: ride.id };
    },
    async getRideDetail(rid) {
      const r = rides.find((x) => x.id === rid);
      if (!r) return null;
      const d = r.driverProfileId ? byProfile(r.driverProfileId) : undefined;
      const v = d?.vehicles.find((x) => x.id === r.vehicleId);
      return {
        ...r, hasReview: r.reviewed,
        driverLocation: d && d.lat !== null && d.lng !== null ? { lat: d.lat, lng: d.lng } : r.driverLocation,
        driver: d ? { fullName: d.name, ratingAverage: 4.5, ratingCount: 3, vehicle: v ? { make: v.make, model: v.model, colour: v.colour, registration: v.registration } : null } : r.driver,
      };
    },
    async listPassengerRides(pid, { scope, page, pageSize }) {
      const mine = rides.filter((r) => r.passengerProfileId === pid && (scope === 'all' || (scope === 'active') === isActive(r)));
      const items: RideSummary[] = mine.slice((page - 1) * pageSize, page * pageSize).map((r) => ({ id: r.id, status: r.status, categoryName: r.category.name, pickupAddress: r.pickup.address, dropoffAddress: r.dropoff.address, currency: r.currency, estimatedFareMinor: r.estimatedFareMinor, finalFareMinor: r.finalFareMinor, requestedAt: r.requestedAt }));
      return { items, total: mine.length };
    },
    async transitionRide({ rideId, from, to, actorType, actorId, note, data, requireDriverId }) {
      const r = rides.find((x) => x.id === rideId);
      if (!r || r.status !== from) return false;
      if (requireDriverId && r.driverProfileId !== requireDriverId) return false;
      r.status = to;
      if (data) {
        const { driverId, vehicleId, declinedBy, fareBreakdown, ...rest } = data;
        Object.assign(r, rest);
        if ('driverId' in data) { r.driverProfileId = driverId ?? null; if (!driverId) { r.driverUserId = null; r.driver = null; } }
        if ('vehicleId' in data) r.vehicleId = vehicleId ?? null;
        if (declinedBy !== undefined) r.declinedBy = declinedBy.split(',').filter(Boolean);
        if (fareBreakdown) r.fareBreakdown = fareBreakdown;
      }
      r.statusHistory.push({ fromStatus: from, toStatus: to, actorType, actorId, note: note ?? null, createdAt: new Date() });
      return true;
    },
    async getMatchingInfo(rid): Promise<MatchingInfo | null> {
      const r = rides.find((x) => x.id === rid);
      if (!r) return null;
      const lastSearch = [...r.statusHistory].reverse().find((h) => h.toStatus === 'SEARCHING_FOR_DRIVER');
      return { id: r.id, status: r.status, categoryId: r.categoryId, pickup: { lat: r.pickup.lat, lng: r.pickup.lng }, declinedBy: r.declinedBy, assignedAt: r.assignedAt, driverProfileId: r.driverProfileId, searchStartedAt: lastSearch?.createdAt ?? r.requestedAt };
    },
    async findCandidateDrivers(categoryId, exclude): Promise<Candidate[]> {
      return [...drivers.values()].flatMap((d) => {
        const v = d.vehicles.find((x) => x.categoryId === categoryId && x.isActive);
        const ok = d.approval === 'APPROVED' && d.isOnline && d.userStatus === 'ACTIVE' && d.lat !== null && d.lng !== null && v && !exclude.includes(d.id) && !driverBusy(d.id);
        return ok ? [{ driverProfileId: d.id, vehicleId: v.id, lat: d.lat!, lng: d.lng! }] : [];
      });
    },
    async claimDriver({ rideId, driverProfileId, vehicleId, assignedAt }) {
      const r = rides.find((x) => x.id === rideId);
      if (!r || r.status !== 'SEARCHING_FOR_DRIVER' || driverBusy(driverProfileId)) return false; // check and write in one synchronous step, like the SQL statement
      r.status = 'DRIVER_ASSIGNED'; r.driverProfileId = driverProfileId; r.vehicleId = vehicleId; r.assignedAt = assignedAt; r.driverUserId = byProfile(driverProfileId)!.userId;
      r.statusHistory.push({ fromStatus: 'SEARCHING_FOR_DRIVER', toStatus: 'DRIVER_ASSIGNED', actorType: 'SYSTEM', note: null, createdAt: new Date() });
      return true;
    },
    async listSearchingRideIds(limit) { return rides.filter((r) => r.status === 'SEARCHING_FOR_DRIVER').slice(0, limit).map((r) => r.id); },
    async createReview({ rideId, authorUserId, rating }) {
      if (reviews.some((v) => v.rideId === rideId && v.authorUserId === authorUserId)) throw AppError.conflict('You have already reviewed this ride.');
      reviews.push({ rideId, authorUserId, rating });
      rides.find((r) => r.id === rideId)!.reviewed = true;
    },
    async listSavedLocations(pid) { return saved.filter((s) => s.passengerId === pid); },
    async countSavedLocations(pid) { return saved.filter((s) => s.passengerId === pid).length; },
    async createSavedLocation(pid, data) { const row = { id: id('s'), passengerId: pid, createdAt: new Date(), ...data }; saved.push(row); return row; },
    async deleteSavedLocation(pid, lid) { const i = saved.findIndex((s) => s.id === lid && s.passengerId === pid); if (i < 0) return false; saved.splice(i, 1); return true; },
  };

  const driversRepo: DriversRepository = {
    async getContext(userId): Promise<DriverContext | null> {
      const d = drivers.get(userId);
      return d ? { id: d.id, userId, approvalStatus: d.approval, isOnline: d.isOnline, lat: d.lat, lng: d.lng, activeVehicleCount: d.vehicles.filter((v) => v.isActive).length } : null;
    },
    async setAvailability(pid, { isOnline, lat, lng }) { const d = byProfile(pid)!; d.isOnline = isOnline; if (lat !== undefined && lng !== undefined) { d.lat = lat; d.lng = lng; } },
    async hasActiveRide(pid) { return driverBusy(pid); },
    async listVehicles(pid) { return byProfile(pid)!.vehicles; },
    async createVehicle(pid, data) {
      if ([...drivers.values()].some((d) => d.vehicles.some((v) => v.registration === data.registration))) throw AppError.conflict('A vehicle with that registration is already registered.');
      const cat = categories.find((c) => c.id === data.categoryId)!;
      const v = { id: id('v'), isActive: true, category: { code: cat.code, name: cat.name }, ...data };
      byProfile(pid)!.vehicles.push(v);
      return v;
    },
    async listRides(pid, { scope, page, pageSize }) {
      const mine = rides.filter((r) => r.driverProfileId === pid && (scope === 'all' || (scope === 'active') === isActive(r)));
      const items: DriverRideSummary[] = mine.slice((page - 1) * pageSize, page * pageSize).map((r) => ({ id: r.id, status: r.status, categoryName: r.category.name, pickupAddress: r.pickup.address, dropoffAddress: r.dropoff.address, currency: r.currency, estimatedFareMinor: r.estimatedFareMinor, finalFareMinor: r.finalFareMinor, requestedAt: r.requestedAt, completedAt: r.completedAt, payment: hooks.paymentFor(r.id) }));
      return { items, total: mine.length };
    },
    async findCurrentOfferRideId(pid) { return rides.find((r) => r.driverProfileId === pid && r.status === 'DRIVER_ASSIGNED')?.id ?? null; },
    async listCompletedSince(pid, since) {
      return rides.flatMap((r) => (r.driverProfileId === pid && r.status === 'COMPLETED' && r.completedAt && r.completedAt >= since && r.finalFareMinor !== null ? [{ completedAt: r.completedAt, finalFareMinor: r.finalFareMinor }] : []));
    },
    async countResponses(userId) {
      const all = rides.flatMap((r) => r.statusHistory);
      return {
        accepted: all.filter((h) => h.actorId === userId && h.toStatus === 'DRIVER_ARRIVING').length,
        declined: all.filter((h) => h.actorId === userId && h.fromStatus === 'DRIVER_ASSIGNED' && h.toStatus === 'SEARCHING_FOR_DRIVER').length,
      };
    },
    async countCompleted(pid) { return rides.filter((r) => r.driverProfileId === pid && r.status === 'COMPLETED').length; },
    async listDocuments(pid) { return docs.filter((d) => d.driverId === pid); },
    async countDocuments(pid) { return docs.filter((d) => d.driverId === pid).length; },
    async createDocument(pid, data) {
      const row: DocumentRow = { id: id('doc'), driverId: pid, status: 'SUBMITTED', reviewNote: null, createdAt: new Date(), reviewedAt: null, ...data };
      docs.push(row);
      return row;
    },
    async getOwnDocument(pid, did) { return docs.find((d) => d.id === did && d.driverId === pid) ?? null; },
  };

  const initial = categories.map((c) => ({ name: c.name, description: c.description, capacity: c.capacity, fare: { ...c.fare } }));
  const reset = () => {
    rides.length = 0; saved.length = 0; reviews.length = 0; docs.length = 0; drivers.clear();
    categories.forEach((c, i) => { Object.assign(c, { name: initial[i]!.name, description: initial[i]!.description, capacity: initial[i]!.capacity }); Object.assign(c.fare, initial[i]!.fare); });
  };
  return { ridesRepo, driversRepo, rides, saved, reviews, docs, drivers, categories, byProfile, addDriver, reset, hooks };
}

export const world = createFakeWorld();
