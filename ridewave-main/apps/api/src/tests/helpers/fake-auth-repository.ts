import type { AuthRepository } from '../../repositories/auth.repository';
import type { ResetTokenRecord, SessionRecord, UserRecord } from '../../types/auth';
import { AppError } from '../../utils/errors';

/** In-memory stand-in for the Prisma repository so auth logic can be tested without a database. */
export function createFakeAuthRepository() {
  let seq = 0;
  const id = () => `id_${++seq}`;
  const users: UserRecord[] = [];
  const sessions: SessionRecord[] = [];
  const resets: ResetTokenRecord[] = [];
  const driverProfiles = new Map<string, { id: string; approvalStatus: string; isOnline: boolean; ratingAverage: number; ratingCount: number; currentLat: number | null; currentLng: number | null; vehicles: [] }>();
  const passengerProfiles = new Map<string, { id: string; preferredLanguage: string; ratingAverage: number; ratingCount: number }>();

  const repo: AuthRepository = {
    async findUserByEmail(email) { return users.find((u) => u.email === email) ?? null; },
    async findUserById(uid) { return users.find((u) => u.id === uid) ?? null; },
    async findUserByPhone(phone) { return users.find((u) => u.phone === phone) ?? null; },
    async createUserWithProfile(input) {
      if (users.some((u) => u.email === input.email)) throw AppError.conflict('An account with this email or phone number already exists.');
      const user: UserRecord = { id: id(), email: input.email, phone: input.phone, passwordHash: input.passwordHash, fullName: input.fullName, role: input.role, status: 'ACTIVE', createdAt: new Date() };
      users.push(user);
      if (input.role === 'PASSENGER') passengerProfiles.set(user.id, { id: id(), preferredLanguage: 'en', ratingAverage: 0, ratingCount: 0 });
      else driverProfiles.set(user.id, { id: id(), approvalStatus: 'PENDING', isOnline: false, ratingAverage: 0, ratingCount: 0, currentLat: null, currentLng: null, vehicles: [] });
      return user;
    },
    async updateUser(uid, data) {
      const u = users.find((x) => x.id === uid)!;
      Object.assign(u, data);
      return u;
    },
    async updatePassword(uid, hash) { users.find((u) => u.id === uid)!.passwordHash = hash; },
    async createSession(data) {
      const s: SessionRecord = { id: id(), userId: data.userId, tokenHash: data.tokenHash, expiresAt: data.expiresAt, revokedAt: null };
      sessions.push(s);
      return s;
    },
    async findSessionWithUser(tokenHash) {
      const s = sessions.find((x) => x.tokenHash === tokenHash);
      if (!s) return null;
      return { ...s, user: users.find((u) => u.id === s.userId)! };
    },
    async revokeSession(sid) { sessions.find((s) => s.id === sid)!.revokedAt = new Date(); },
    async revokeUserSessions(uid, except) {
      sessions.filter((s) => s.userId === uid && s.id !== except && !s.revokedAt).forEach((s) => { s.revokedAt = new Date(); });
    },
    async createResetToken(d) { resets.push({ id: id(), userId: d.userId, tokenHash: d.tokenHash, expiresAt: d.expiresAt, usedAt: null }); },
    async findResetToken(h) { return resets.find((r) => r.tokenHash === h) ?? null; },
    async markResetTokenUsed(rid) { resets.find((r) => r.id === rid)!.usedAt = new Date(); },
    async getPassengerProfile(uid) { return passengerProfiles.get(uid) ?? null; },
    async getDriverProfile(uid) { return driverProfiles.get(uid) ?? null; },
    async listUsers({ search, role, status, sort, dir, page, pageSize }) {
      const matched = users
        .filter((u) => (!search || u.email.includes(search) || u.fullName.includes(search)) && (!role || u.role === role) && (!status || u.status === status))
        .sort((x, y) => {
          const a = String(sort === 'createdAt' ? x.createdAt.getTime() : x[sort]).padStart(20, '0');
          const b = String(sort === 'createdAt' ? y.createdAt.getTime() : y[sort]).padStart(20, '0');
          return (a < b ? -1 : a > b ? 1 : 0) * (dir === 'asc' ? 1 : -1);
        });
      return { items: matched.slice((page - 1) * pageSize, page * pageSize).map(({ passwordHash: _p, ...rest }) => (void _p, rest)), total: matched.length };
    },
    async setUserStatus(uid, status) { const u = users.find((x) => x.id === uid); if (!u) return null; u.status = status; return u; },
  };
  return { repo, users, sessions, resets };
}

export const authWorld = createFakeAuthRepository();
