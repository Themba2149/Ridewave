import type { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import type { Page } from '../types/admin';
import type { AdminPaymentRow, PaymentMethodRow, PaymentMethodType, PaymentRow, PaymentStatus, PaymentSummary } from '../types/payment';
import { AppError } from '../utils/errors';

export interface PaymentsRepository {
  findByRide(rideId: string): Promise<PaymentRow[]>; // newest first
  getById(id: string): Promise<PaymentRow | null>;
  create(i: { rideId: string; method: PaymentMethodType; status: PaymentStatus; amountMinor: number; currency: string; provider: string; transactionRef?: string; idempotencyKey: string; description: string }): Promise<PaymentRow>;
  /** Changes status and writes a PaymentEvent in one transaction (the payment audit trail). */
  update(id: string, data: { status: PaymentStatus; transactionRef?: string; failureReason?: string | null }, event: { type: string; detail?: string }): Promise<PaymentRow>;
  listAll(q: { status?: PaymentStatus; method?: PaymentMethodType; page: number; pageSize: number }): Promise<Page<AdminPaymentRow>>;
  summary(): Promise<PaymentSummary>;
  listMethods(passengerProfileId: string): Promise<PaymentMethodRow[]>;
  getMethod(passengerProfileId: string, id: string): Promise<PaymentMethodRow | null>;
  createMethod(passengerProfileId: string, data: { type: 'CARD' | 'DIGITAL_WALLET'; label: string; last4: string | null; providerToken: string; isDefault: boolean }): Promise<PaymentMethodRow>;
  deleteMethod(passengerProfileId: string, id: string): Promise<boolean>;
  setDefaultMethod(passengerProfileId: string, id: string): Promise<boolean>;
}

const include = { ride: { select: { passenger: { select: { userId: true } }, driver: { select: { userId: true } } } }, events: { orderBy: { createdAt: 'asc' as const }, take: 1 } } satisfies Prisma.PaymentInclude;
type Raw = Prisma.PaymentGetPayload<{ include: typeof include }>;
const toRow = (p: Raw): PaymentRow => ({
  id: p.id, rideId: p.rideId, method: p.method, status: p.status, amountMinor: p.amountMinor, currency: p.currency, provider: p.provider, transactionRef: p.transactionRef,
  failureReason: p.failureReason, description: p.events[0]?.detail ?? null, createdAt: p.createdAt, updatedAt: p.updatedAt, passengerUserId: p.ride.passenger.userId, driverUserId: p.ride.driver?.userId ?? null,
});
const methodSelect = { id: true, type: true, label: true, last4: true, providerToken: true, isDefault: true, createdAt: true } as const;
const asMethod = (m: { id: string; type: PaymentMethodType; label: string; last4: string | null; providerToken: string | null; isDefault: boolean; createdAt: Date }): PaymentMethodRow => ({ ...m, type: m.type as 'CARD' | 'DIGITAL_WALLET' });
const isUnique = (e: unknown) => typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2002';

export const paymentsRepository: PaymentsRepository = {
  async findByRide(rideId) { return (await prisma.payment.findMany({ where: { rideId }, orderBy: { createdAt: 'desc' }, include })).map(toRow); },
  async getById(id) { const p = await prisma.payment.findUnique({ where: { id }, include }); return p ? toRow(p) : null; },

  async create(i) {
    try {
      const p = await prisma.payment.create({
        data: { rideId: i.rideId, method: i.method, status: i.status, amountMinor: i.amountMinor, currency: i.currency, provider: i.provider, transactionRef: i.transactionRef, idempotencyKey: i.idempotencyKey,
          events: { create: { type: 'CREATED', toStatus: i.status, detail: i.description } } },
        include,
      });
      return toRow(p);
    } catch (e) {
      if (isUnique(e)) throw AppError.conflict('A payment for this ride was already started.'); // the unique key is what stops duplicate charging
      throw e;
    }
  },

  async update(id, data, event) {
    return prisma.$transaction(async (tx) => {
      const before = await tx.payment.findUniqueOrThrow({ where: { id }, select: { status: true } });
      const p = await tx.payment.update({ where: { id }, data: { status: data.status, ...(data.transactionRef ? { transactionRef: data.transactionRef } : {}), ...(data.failureReason !== undefined ? { failureReason: data.failureReason } : {}) }, include });
      await tx.paymentEvent.create({ data: { paymentId: id, type: event.type, fromStatus: before.status, toStatus: data.status, detail: event.detail } });
      return toRow(p);
    });
  },

  async listAll({ status, method, page, pageSize }) {
    const where: Prisma.PaymentWhereInput = { ...(status ? { status } : {}), ...(method ? { method } : {}) };
    const [rows, total] = await Promise.all([
      prisma.payment.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize, include: { ride: { select: { passenger: { select: { user: { select: { fullName: true } } } } } } } }),
      prisma.payment.count({ where }),
    ]);
    return {
      total,
      items: rows.map((p) => ({ id: p.id, rideId: p.rideId, passengerName: p.ride.passenger.user.fullName, method: p.method, status: p.status, amountMinor: p.amountMinor, currency: p.currency, provider: p.provider, transactionRef: p.transactionRef, failureReason: p.failureReason, createdAt: p.createdAt })),
    };
  },
  async summary() {
    const [succeeded, pending, groups] = await Promise.all([
      prisma.payment.aggregate({ where: { status: 'SUCCEEDED' }, _sum: { amountMinor: true } }),
      prisma.payment.aggregate({ where: { status: { in: ['PENDING', 'PROCESSING'] } }, _sum: { amountMinor: true } }),
      prisma.payment.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    return { succeededMinor: succeeded._sum.amountMinor ?? 0, pendingMinor: pending._sum.amountMinor ?? 0, counts: Object.fromEntries(groups.map((g) => [g.status, g._count._all])) };
  },

  async listMethods(pid) { return (await prisma.paymentMethod.findMany({ where: { passengerId: pid }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }], select: methodSelect })).map(asMethod); },
  async getMethod(pid, id) { const m = await prisma.paymentMethod.findFirst({ where: { id, passengerId: pid }, select: methodSelect }); return m ? asMethod(m) : null; }, // owner-scoped
  async createMethod(pid, data) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.paymentMethod.count({ where: { passengerId: pid } });
      const makeDefault = data.isDefault || existing === 0;
      if (makeDefault) await tx.paymentMethod.updateMany({ where: { passengerId: pid }, data: { isDefault: false } });
      return asMethod(await tx.paymentMethod.create({ data: { passengerId: pid, ...data, isDefault: makeDefault }, select: methodSelect }));
    });
  },
  async deleteMethod(pid, id) { return (await prisma.paymentMethod.deleteMany({ where: { id, passengerId: pid } })).count > 0; },
  async setDefaultMethod(pid, id) {
    return prisma.$transaction(async (tx) => {
      if (!(await tx.paymentMethod.findFirst({ where: { id, passengerId: pid }, select: { id: true } }))) return false;
      await tx.paymentMethod.updateMany({ where: { passengerId: pid }, data: { isDefault: false } });
      await tx.paymentMethod.update({ where: { id }, data: { isDefault: true } });
      return true;
    });
  },
};
