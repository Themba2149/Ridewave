export type Role = 'PASSENGER' | 'DRIVER' | 'ADMIN';
export type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';

export interface UserRecord {
  id: string; email: string; phone: string | null; passwordHash: string; fullName: string;
  role: Role; status: AccountStatus; createdAt: Date;
}
export interface SessionRecord { id: string; userId: string; tokenHash: string; expiresAt: Date; revokedAt: Date | null }
export interface ResetTokenRecord { id: string; userId: string; tokenHash: string; expiresAt: Date; usedAt: Date | null }

/** User shape that is safe to return to clients (never includes the password hash). */
export type PublicUser = Omit<UserRecord, 'passwordHash'>;

export interface AuthContext { user: UserRecord; sessionId: string }
