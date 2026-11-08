import { prisma } from '../config/database';
import type { AccountStatus, ResetTokenRecord, Role, SessionRecord, UserRecord } from '../types/auth';
import { AppError } from '../utils/errors';

export interface AuthRepository {
  findUserByEmail(email: string): Promise<UserRecord | null>;
  findUserById(id: string): Promise<UserRecord | null>;
  findUserByPhone(phone: string): Promise<UserRecord | null>;
  createUserWithProfile(input: { email: string; phone: string | null; passwordHash: string; fullName: string; role: Exclude<Role, 'ADMIN'> }): Promise<UserRecord>;
  updateUser(id: string, data: { fullName?: string; phone?: string | null }): Promise<UserRecord>;
  updatePassword(id: string, passwordHash: string): Promise<void>;
  createSession(data: { userId: string; tokenHash: string; expiresAt: Date; userAgent?: string; ipAddress?: string }): Promise<SessionRecord>;
  findSessionWithUser(tokenHash: string): Promise<(SessionRecord & { user: UserRecord }) | null>;
  revokeSession(id: string): Promise<void>;
  revokeUserSessions(userId: string, exceptSessionId?: string): Promise<void>;
  createResetToken(data: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void>;
  findResetToken(tokenHash: string): Promise<ResetTokenRecord | null>;
  markResetTokenUsed(id: string): Promise<void>;
  getPassengerProfile(userId: string): Promise<{ id: string; preferredLanguage: string; ratingAverage: number; ratingCount: number } | null>;
  getDriverProfile(userId: string): Promise<{
    id: string; approvalStatus: string; isOnline: boolean; ratingAverage: number; ratingCount: number; currentLat: number | null; currentLng: number | null;
    vehicles: Array<{ id: string; make: string; model: string; year: number; registration: string }>;
  } | null>;
  listUsers(q: { search?: string; role?: Role; status?: AccountStatus; sort: 'createdAt' | 'fullName' | 'email' | 'role'; dir: 'asc' | 'desc'; page: number; pageSize: number }): Promise<{ items: Omit<UserRecord, 'passwordHash'>[]; total: number }>;
  setUserStatus(id: string, status: AccountStatus): Promise<UserRecord | null>;
}

const isUniqueViolation = (e: unknown) => typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2002';

export const authRepository: AuthRepository = {
  findUserByEmail: (email) => prisma.user.findUnique({ where: { email } }),
  findUserById: (id) => prisma.user.findUnique({ where: { id } }),
  findUserByPhone: (phone) => prisma.user.findUnique({ where: { phone } }),

  async createUserWithProfile({ email, phone, passwordHash, fullName, role }) {
    try {
      // Nested create runs in one transaction: the user and its profile exist together or not at all.
      return await prisma.user.create({
        data: {
          email, phone, passwordHash, fullName, role,
          ...(role === 'PASSENGER' ? { passengerProfile: { create: {} } } : { driverProfile: { create: {} } }),
        },
      });
    } catch (e) {
      if (isUniqueViolation(e)) throw AppError.conflict('An account with this email or phone number already exists.');
      throw e;
    }
  },

  async updateUser(id, data) {
    try {
      return await prisma.user.update({ where: { id }, data });
    } catch (e) {
      if (isUniqueViolation(e)) throw AppError.conflict('That phone number is already in use.');
      throw e;
    }
  },
  async updatePassword(id, passwordHash) { await prisma.user.update({ where: { id }, data: { passwordHash } }); },

  createSession: (data) => prisma.session.create({ data }),
  findSessionWithUser: (tokenHash) => prisma.session.findUnique({ where: { tokenHash }, include: { user: true } }),
  async revokeSession(id) { await prisma.session.update({ where: { id }, data: { revokedAt: new Date() } }); },
  async revokeUserSessions(userId, exceptSessionId) {
    await prisma.session.updateMany({
      where: { userId, revokedAt: null, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
      data: { revokedAt: new Date() },
    });
  },

  async createResetToken(data) { await prisma.passwordResetToken.create({ data }); },
  findResetToken: (tokenHash) => prisma.passwordResetToken.findUnique({ where: { tokenHash } }),
  async markResetTokenUsed(id) { await prisma.passwordResetToken.update({ where: { id }, data: { usedAt: new Date() } }); },

  getPassengerProfile: (userId) => prisma.passengerProfile.findUnique({ where: { userId } }),
  getDriverProfile: (userId) =>
    prisma.driverProfile.findUnique({ where: { userId }, include: { vehicles: { select: { id: true, make: true, model: true, year: true, registration: true } } } }),

  async listUsers({ search, role, status, sort, dir, page, pageSize }) {
    const where = {
      ...(search ? { OR: [{ email: { contains: search } }, { fullName: { contains: search } }] } : {}),
      ...(role ? { role } : {}), ...(status ? { status } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where, orderBy: { [sort]: dir }, skip: (page - 1) * pageSize, take: pageSize,
        select: { id: true, email: true, phone: true, fullName: true, role: true, status: true, createdAt: true },
      }),
      prisma.user.count({ where }),
    ]);
    return { items, total };
  },

  async setUserStatus(id, status) {
    try {
      return await prisma.user.update({ where: { id }, data: { status } });
    } catch {
      return null; // not found
    }
  },
};
