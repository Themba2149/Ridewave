// Seed: ride categories, demonstration fares, and DEVELOPMENT-ONLY demo accounts (synthetic data).
// Rates are ILLUSTRATIVE demonstration values in ZAR cents, not market-verified prices.
// Demo rides are added in Phase 4. Demo accounts are never created when NODE_ENV=production.
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { devMapProvider, SAMPLE_PLACES } from '../src/providers/dev-map-provider';
import { calculateFare } from '../src/services/pricing.service';

const prisma = new PrismaClient();

const categories = [
  { code: 'ECONOMY', name: 'RideWave Economy', description: 'Affordable everyday rides.', capacity: 4, luggageNote: '1 large bag or 2 small bags', sortOrder: 1,
    fare: { base: 1500, km: 750, min: 900, minimum: 3000, fee: 500 } },
  { code: 'COMFORT', name: 'RideWave Comfort', description: 'Newer cars with extra space.', capacity: 4, luggageNote: '2 large bags', sortOrder: 2,
    fare: { base: 2000, km: 950, min: 1100, minimum: 4000, fee: 500 } },
  { code: 'XL', name: 'RideWave XL', description: 'Seats up to six passengers.', capacity: 6, luggageNote: '3 large bags', sortOrder: 3,
    fare: { base: 2800, km: 1300, min: 1500, minimum: 5500, fee: 500 } },
  { code: 'PREMIUM', name: 'RideWave Premium', description: 'Top-rated drivers in premium vehicles.', capacity: 4, luggageNote: '2 large bags', sortOrder: 4,
    fare: { base: 3500, km: 1700, min: 1800, minimum: 7000, fee: 500 } },
];

// Documented in README. Development only: never use these credentials anywhere real.
const DEMO_PASSWORD = 'RideWave-Demo-2026';
const demoUsers = [
  { email: 'admin@ridewave.test', fullName: 'Demo Admin', role: 'ADMIN' },
  { email: 'passenger1@ridewave.test', fullName: 'Demo Passenger One', role: 'PASSENGER' },
  { email: 'passenger2@ridewave.test', fullName: 'Demo Passenger Two', role: 'PASSENGER' },
  { email: 'driver1@ridewave.test', fullName: 'Demo Driver One', role: 'DRIVER', approval: 'APPROVED', online: true, lat: -26.1076, lng: 28.0567, vehicle: { make: 'Toyota', model: 'Etios', year: 2019, colour: 'White', registration: 'DEMO001GP', cat: 'ECONOMY', seats: 4 } },
  { email: 'driver2@ridewave.test', fullName: 'Demo Driver Two', role: 'DRIVER', approval: 'APPROVED', online: true, lat: -26.2041, lng: 28.0473, vehicle: { make: 'Volkswagen', model: 'Polo', year: 2021, colour: 'Grey', registration: 'DEMO002GP', cat: 'COMFORT', seats: 4 } },
  { email: 'driver3@ridewave.test', fullName: 'Demo Driver Three (pending)', role: 'DRIVER', approval: 'PENDING', online: false },
] as const;

async function seedDemoUsers() {
  if (process.env.NODE_ENV === 'production') {
    console.log('NODE_ENV=production: demo accounts were NOT created.');
    return;
  }
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  for (const u of demoUsers) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    if (existing) continue; // never overwrite an account's password or data on re-seed
    const user = await prisma.user.create({
      data: { email: u.email, fullName: u.fullName, role: u.role, passwordHash,
        ...(u.role === 'PASSENGER' ? { passengerProfile: { create: {} } } : {}),
        ...(u.role === 'DRIVER' ? { driverProfile: { create: {
          approvalStatus: u.approval, isOnline: u.online, approvedAt: u.approval === 'APPROVED' ? new Date() : null,
          approvalNote: 'Demonstration data: simulated approval, no documents were verified.',
          ...('lat' in u ? { currentLat: u.lat, currentLng: u.lng, locationUpdatedAt: new Date() } : {}),
        } } } : {}) },
      include: { driverProfile: true },
    });
    if ('vehicle' in u && user.driverProfile) {
      const category = await prisma.rideCategory.findUnique({ where: { code: u.vehicle.cat } });
      if (category) {
        await prisma.vehicle.create({ data: { driverId: user.driverProfile.id, categoryId: category.id, make: u.vehicle.make, model: u.vehicle.model,
          year: u.vehicle.year, colour: u.vehicle.colour, registration: u.vehicle.registration, passengerCapacity: u.vehicle.seats } });
      }
    }
  }
  console.log(`\nDemo accounts (password for all: ${DEMO_PASSWORD})\n` + demoUsers.map((u) => `  ${u.role.padEnd(9)} ${u.email}`).join('\n'));
}

async function seedDemoRides() {
  if (process.env.NODE_ENV === 'production') return;
  const passenger = await prisma.user.findUnique({ where: { email: 'passenger1@ridewave.test' }, include: { passengerProfile: true } });
  const loadDriver = (email: string) => prisma.user.findUnique({ where: { email }, include: { driverProfile: { include: { vehicles: true } } } });
  const [d1, d2] = await Promise.all([loadDriver('driver1@ridewave.test'), loadDriver('driver2@ridewave.test')]);
  const pp = passenger?.passengerProfile;
  if (!passenger || !pp || !d1?.driverProfile || !d2?.driverProfile) return;

  const place = (id: string) => SAMPLE_PLACES.find((p) => p.id === id)!;
  const MIN = 60_000, DAY = 24 * 60 * MIN;

  // Saved places
  if ((await prisma.savedLocation.count({ where: { passengerId: pp.id } })) === 0) {
    await prisma.savedLocation.createMany({ data: [
      { passengerId: pp.id, label: 'Home', address: place('rosebank-mall').address, lat: place('rosebank-mall').lat, lng: place('rosebank-mall').lng, isFavorite: true },
      { passengerId: pp.id, label: 'Work', address: place('sandton-city').address, lat: place('sandton-city').lat, lng: place('sandton-city').lng, isFavorite: true },
    ] });
  }

  const defs = [
    { key: 'seed-ride-1', from: 'sandton-city', to: 'rosebank-mall', cat: 'ECONOMY', driver: d1, status: 'COMPLETED' as const, daysAgo: 3 },
    { key: 'seed-ride-2', from: 'wits', to: 'melrose-arch', cat: 'COMFORT', driver: d2, status: 'COMPLETED' as const, daysAgo: 1 },
    { key: 'seed-ride-3', from: 'maboneng', to: 'gold-reef-city', cat: 'ECONOMY', driver: null, status: 'CANCELLED' as const, daysAgo: 6 },
  ];
  for (const d of defs) {
    if (await prisma.ride.findFirst({ where: { passengerId: pp.id, idempotencyKey: d.key } })) continue;
    const category = await prisma.rideCategory.findUnique({ where: { code: d.cat }, include: { fareConfigurations: { where: { isActive: true }, take: 1 } } });
    const cfg = category?.fareConfigurations[0];
    if (!category || !cfg) continue;
    const a = place(d.from), b = place(d.to);
    const route = await devMapProvider.estimateRoute(a, b);
    const fare = calculateFare(cfg, route.distanceMeters, route.durationSeconds);
    const t0 = new Date(Date.now() - d.daysAgo * DAY);
    const at = (m: number) => new Date(t0.getTime() + m * MIN);
    const completed = d.status === 'COMPLETED';
    const history = [
      { fromStatus: null, toStatus: 'REQUESTED' as const, actorType: 'PASSENGER' as const, createdAt: at(0) },
      { fromStatus: 'REQUESTED' as const, toStatus: 'SEARCHING_FOR_DRIVER' as const, actorType: 'SYSTEM' as const, createdAt: at(0) },
      ...(completed ? [
        { fromStatus: 'SEARCHING_FOR_DRIVER' as const, toStatus: 'DRIVER_ASSIGNED' as const, actorType: 'SYSTEM' as const, createdAt: at(1) },
        { fromStatus: 'DRIVER_ASSIGNED' as const, toStatus: 'DRIVER_ARRIVING' as const, actorType: 'DRIVER' as const, createdAt: at(2) },
        { fromStatus: 'DRIVER_ARRIVING' as const, toStatus: 'DRIVER_ARRIVED' as const, actorType: 'DRIVER' as const, createdAt: at(7) },
        { fromStatus: 'DRIVER_ARRIVED' as const, toStatus: 'IN_PROGRESS' as const, actorType: 'DRIVER' as const, createdAt: at(9) },
        { fromStatus: 'IN_PROGRESS' as const, toStatus: 'COMPLETED' as const, actorType: 'DRIVER' as const, createdAt: at(9 + Math.ceil(route.durationSeconds / 60)) },
      ] : [{ fromStatus: 'SEARCHING_FOR_DRIVER' as const, toStatus: 'CANCELLED' as const, actorType: 'PASSENGER' as const, note: 'Demonstration data: changed plans', createdAt: at(3) }]),
    ];
    await prisma.ride.create({ data: {
      passengerId: pp.id, categoryId: category.id, idempotencyKey: d.key, status: d.status,
      driverId: d.driver?.driverProfile?.id, vehicleId: d.driver?.driverProfile?.vehicles[0]?.id,
      pickupAddress: a.address, pickupLat: a.lat, pickupLng: a.lng, dropoffAddress: b.address, dropoffLat: b.lat, dropoffLng: b.lng,
      currency: fare.currency, distanceMeters: fare.distanceMeters, durationSeconds: fare.durationSeconds,
      estimatedFareMinor: fare.totalMinor, finalFareMinor: completed ? fare.totalMinor : null, fareBreakdown: fare, routeSource: 'dev-sample (demonstration data)',
      requestedAt: t0, assignedAt: completed ? at(1) : null, arrivedAt: completed ? at(7) : null, startedAt: completed ? at(9) : null,
      completedAt: completed ? at(9 + Math.ceil(route.durationSeconds / 60)) : null,
      cancelledAt: completed ? null : at(3), cancelledBy: completed ? null : 'PASSENGER', cancellationReason: completed ? null : 'Changed plans',
      statusHistory: { create: history },
    } });
  }

  // One review on ride 1 only, so ride 2 can be used to try the review form.
  const ride1 = await prisma.ride.findFirst({ where: { passengerId: pp.id, idempotencyKey: 'seed-ride-1' } });
  if (ride1 && !(await prisma.review.findFirst({ where: { rideId: ride1.id } }))) {
    await prisma.review.create({ data: { rideId: ride1.id, authorId: passenger.id, subjectId: d1.id, rating: 5, comment: 'Demonstration review: smooth ride.' } });
    await prisma.driverProfile.update({ where: { id: d1.driverProfile.id }, data: { ratingAverage: 5, ratingCount: 1 } });
  }
  const paid = await prisma.ride.findFirst({ where: { passengerId: pp.id, idempotencyKey: 'seed-ride-1' } });
  if (paid?.finalFareMinor && !(await prisma.payment.findFirst({ where: { rideId: paid.id } }))) {
    await prisma.payment.create({ data: {
      rideId: paid.id, method: 'CARD', status: 'SUCCEEDED', amountMinor: paid.finalFareMinor, currency: 'ZAR', provider: 'dev', transactionRef: 'dev_txn_seed0001', idempotencyKey: `${paid.id}:1`,
      events: { create: [{ type: 'CREATED', toStatus: 'SUCCEEDED', detail: 'Demonstration payment (simulated, no real money moves)' }] },
    } });
  }
  console.log('Demo rides: 2 completed (one reviewed, one awaiting review) and 1 cancelled, for passenger1@ridewave.test.');
}

async function seedDemoSupport() {
  if (process.env.NODE_ENV === 'production') return;
  if ((await prisma.supportTicket.count()) > 0) return;
  await prisma.supportTicket.createMany({ data: [
    { name: 'Demo Visitor', email: 'visitor@ridewave.test', subject: 'How do I become a driver?', message: 'Demonstration ticket: I would like to know what documents I need to drive with RideWave.' },
    { name: 'Demo Passenger One', email: 'passenger1@ridewave.test', subject: 'Receipt question', message: 'Demonstration ticket: can I get a copy of my last receipt?', status: 'IN_PROGRESS' },
  ] });
  console.log('Demo support tickets: 2 created.');
}

async function main() {
  for (const c of categories) {
    const category = await prisma.rideCategory.upsert({
      where: { code: c.code },
      update: { name: c.name, description: c.description, capacity: c.capacity, luggageNote: c.luggageNote, sortOrder: c.sortOrder },
      create: { code: c.code, name: c.name, description: c.description, capacity: c.capacity, luggageNote: c.luggageNote, sortOrder: c.sortOrder },
    });
    const existing = await prisma.fareConfiguration.findFirst({ where: { categoryId: category.id, cityCode: 'JNB', isActive: true } });
    if (!existing) {
      await prisma.fareConfiguration.create({
        data: {
          categoryId: category.id, cityCode: 'JNB', currency: 'ZAR',
          baseFareMinor: c.fare.base, perKmMinor: c.fare.km, perMinuteMinor: c.fare.min,
          minimumFareMinor: c.fare.minimum, bookingFeeMinor: c.fare.fee,
          cancellationFeeMinor: 2000, freeCancelWindowSeconds: 120, demandMultiplierBp: 10000, roundingMinor: 100,
        },
      });
    }
  }
  console.log(`Seeded ${categories.length} ride categories with demonstration fare configurations (re-runnable).`);
  await seedDemoUsers();
  await seedDemoRides();
  await seedDemoSupport();
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
