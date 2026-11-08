import { authRepository as repo } from '../repositories/auth.repository';
import type { PublicUser, UserRecord } from '../types/auth';
import { SESSION_TTL_MS } from '../utils/cookies';
import { AppError } from '../utils/errors';
import { burnPasswordCheck, hashPassword, verifyPassword } from '../utils/password';
import { hashToken, newToken } from '../utils/tokens';
import { disconnectUser } from './realtime.service';
import type { RegisterInput } from '../validators/auth.validators';

export const toPublicUser = ({ passwordHash: _p, ...rest }: UserRecord): PublicUser => {
  void _p;
  return rest;
};

type ClientInfo = { userAgent?: string; ipAddress?: string };
const RESET_TTL_MS = 60 * 60 * 1000;

async function startSession(userId: string, client: ClientInfo) {
  const token = newToken();
  const session = await repo.createSession({ userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + SESSION_TTL_MS), ...client });
  return { token, sessionId: session.id };
}

export async function registerUser(input: RegisterInput, client: ClientInfo) {
  if (await repo.findUserByEmail(input.email)) throw AppError.conflict('An account with this email or phone number already exists.');
  if (input.phone && (await repo.findUserByPhone(input.phone))) throw AppError.conflict('An account with this email or phone number already exists.');
  const user = await repo.createUserWithProfile({
    email: input.email, phone: input.phone ?? null, fullName: input.fullName, role: input.role,
    passwordHash: await hashPassword(input.password),
  });
  const { token } = await startSession(user.id, client);
  return { user: toPublicUser(user), token };
}

export async function loginUser(email: string, password: string, client: ClientInfo) {
  const user = await repo.findUserByEmail(email);
  if (!user) {
    await burnPasswordCheck(password);
    throw new AppError(401, 'UNAUTHENTICATED', 'Incorrect email or password.');
  }
  if (!(await verifyPassword(password, user.passwordHash))) throw new AppError(401, 'UNAUTHENTICATED', 'Incorrect email or password.');
  if (user.status !== 'ACTIVE') throw AppError.forbidden('This account is not active. Please contact support.');
  const { token } = await startSession(user.id, client);
  return { user: toPublicUser(user), token };
}

export async function logoutSession(sessionId: string, userId?: string) {
  await repo.revokeSession(sessionId);
  if (userId) disconnectUser(userId);
}

/** Dev flow: no email is sent. The caller may expose the link only outside production. */
export async function requestPasswordReset(email: string): Promise<{ token: string } | null> {
  const user = await repo.findUserByEmail(email);
  if (!user || user.status !== 'ACTIVE') return null;
  const token = newToken();
  await repo.createResetToken({ userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + RESET_TTL_MS) });
  return { token };
}

export async function resetPassword(token: string, newPassword: string) {
  const record = await repo.findResetToken(hashToken(token));
  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
    throw AppError.validation('This reset link is invalid or has expired. Request a new one.');
  }
  await repo.updatePassword(record.userId, await hashPassword(newPassword));
  await repo.markResetTokenUsed(record.id);
  await repo.revokeUserSessions(record.userId); // sign out everywhere
  disconnectUser(record.userId);
}

export async function changePassword(user: UserRecord, sessionId: string, currentPassword: string, newPassword: string) {
  if (!(await verifyPassword(currentPassword, user.passwordHash))) throw AppError.validation('Your current password is incorrect.');
  await repo.updatePassword(user.id, await hashPassword(newPassword));
  await repo.revokeUserSessions(user.id, sessionId); // keep this session, drop the rest
}

export async function updateProfile(userId: string, data: { fullName?: string; phone?: string | null | undefined }) {
  if (data.phone) {
    const holder = await repo.findUserByPhone(data.phone);
    if (holder && holder.id !== userId) throw AppError.conflict('That phone number is already in use.');
  }
  const patch: { fullName?: string; phone?: string | null } = {};
  if (data.fullName !== undefined) patch.fullName = data.fullName;
  if (data.phone !== undefined) patch.phone = data.phone;
  return toPublicUser(await repo.updateUser(userId, patch));
}
