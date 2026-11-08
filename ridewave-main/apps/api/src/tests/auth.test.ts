import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { createFakeAuthRepository } from './helpers/fake-auth-repository';

type Fake = ReturnType<typeof createFakeAuthRepository>;
const { fake } = vi.hoisted(() => ({ fake: { current: undefined as unknown as Fake } }));

vi.mock('../config/database', () => ({ prisma: { $queryRaw: vi.fn() } }));
vi.mock('../repositories/auth.repository', async () => {
  const { createFakeAuthRepository } = await import('./helpers/fake-auth-repository');
  fake.current = createFakeAuthRepository();
  return { authRepository: fake.current.repo };
});

import { createApp } from '../app';
import { hashPassword, verifyPassword } from '../utils/password';

const app = createApp();
const PASSWORD = 'Sunrise2026x';
const valid = { role: 'PASSENGER', fullName: 'Thandi Nkosi', email: 'thandi@example.com', password: PASSWORD };

beforeEach(() => {
  fake.current.users.length = 0;
  fake.current.sessions.length = 0;
  fake.current.resets.length = 0;
});

function csrfFrom(res: request.Response): string {
  const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  const raw = cookies.find((c) => c.startsWith('ridewave.csrf='));
  return raw ? decodeURIComponent(raw.split(';')[0]!.split('=')[1]!) : '';
}

async function signIn(email: string, password = PASSWORD) {
  const agent = request.agent(app);
  const res = await agent.post('/api/v1/auth/login').send({ email, password });
  return { agent, csrf: csrfFrom(res), res };
}
async function register(overrides: Record<string, unknown> = {}) {
  const agent = request.agent(app);
  const res = await agent.post('/api/v1/auth/register').send({ ...valid, ...overrides });
  return { agent, res, csrf: res.status === 201 ? csrfFrom(res) : '' };
}
async function seedUser(email: string, role: 'PASSENGER' | 'DRIVER' | 'ADMIN', status: 'ACTIVE' | 'SUSPENDED' = 'ACTIVE') {
  const user = await fake.current.repo.createUserWithProfile({ email, phone: null, fullName: email, passwordHash: await hashPassword(PASSWORD), role: role === 'ADMIN' ? 'PASSENGER' : role });
  user.role = role;
  user.status = status;
  return user;
}

describe('registration', () => {
  it('creates a passenger, hashes the password, sets httpOnly session cookie, and never returns the hash', async () => {
    const { res } = await register();
    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({ email: 'thandi@example.com', role: 'PASSENGER' });
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    const stored = fake.current.users[0]!;
    expect(stored.passwordHash).not.toContain(PASSWORD);
    expect(await verifyPassword(PASSWORD, stored.passwordHash)).toBe(true);
    const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
    expect(cookies.find((c) => c.startsWith('ridewave.sid='))).toMatch(/HttpOnly/i);
  });

  it('creates a pending driver profile for driver accounts', async () => {
    const { agent } = await register({ role: 'DRIVER', email: 'sipho@example.com' });
    const res = await agent.get('/api/v1/drivers/me');
    expect(res.status).toBe(200);
    expect(res.body.data.profile.approvalStatus).toBe('PENDING');
  });

  it('rejects the ADMIN role and unknown fields so users cannot grant themselves privileges', async () => {
    expect((await register({ role: 'ADMIN' })).res.status).toBe(400);
    expect((await register({ isAdmin: true })).res.status).toBe(400);
    expect(fake.current.users).toHaveLength(0);
  });

  it('rejects weak passwords and bad emails with field details', async () => {
    const res = (await register({ password: 'short', email: 'nope' })).res;
    expect(res.status).toBe(400);
    expect([...new Set(res.body.error.details.map((d: { path: string }) => d.path))].sort()).toEqual(['email', 'password']);
  });

  it('rejects a duplicate email', async () => {
    await register();
    expect((await register()).res.status).toBe(409);
  });
});

describe('login and logout', () => {
  it('signs in with correct credentials and reads /auth/me', async () => {
    await register();
    const { agent, res } = await signIn('thandi@example.com');
    expect(res.status).toBe(200);
    const me = await agent.get('/api/v1/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe('thandi@example.com');
  });

  it('gives the same error for a wrong password and an unknown email', async () => {
    await register();
    const wrong = await signIn('thandi@example.com', 'Wrong-password1');
    const unknown = await signIn('nobody@example.com');
    expect(wrong.res.status).toBe(401);
    expect(unknown.res.status).toBe(401);
    expect(wrong.res.body.error.message).toBe(unknown.res.body.error.message);
  });

  it('blocks suspended accounts', async () => {
    await seedUser('banned@example.com', 'PASSENGER', 'SUSPENDED');
    expect((await signIn('banned@example.com')).res.status).toBe(403);
  });

  it('logout revokes the session server-side', async () => {
    const { agent, csrf } = await register();
    const out = await agent.post('/api/v1/auth/logout').set('X-CSRF-Token', csrf);
    expect(out.status).toBe(200);
    expect((await agent.get('/api/v1/auth/me')).status).toBe(401);
  });

  it('rejects expired sessions', async () => {
    const { agent } = await register();
    fake.current.sessions[0]!.expiresAt = new Date(Date.now() - 1000);
    expect((await agent.get('/api/v1/auth/me')).status).toBe(401);
  });

  it('requires authentication for /auth/me', async () => {
    expect((await request(app).get('/api/v1/auth/me')).status).toBe(401);
  });
});

describe('CSRF protection', () => {
  it('rejects authenticated state-changing requests without the CSRF header', async () => {
    const { agent } = await register();
    const res = await agent.post('/api/v1/auth/logout');
    expect(res.status).toBe(403);
  });
  it('rejects a wrong CSRF token', async () => {
    const { agent } = await register();
    expect((await agent.post('/api/v1/auth/logout').set('X-CSRF-Token', 'wrong')).status).toBe(403);
  });
  it('rejects requests from another origin', async () => {
    const res = await request(app).post('/api/v1/auth/login').set('Origin', 'https://evil.example').send({ email: 'a@b.co', password: 'x' });
    expect(res.status).toBe(403);
  });
});

describe('role-based access and data isolation', () => {
  it('blocks passengers from admin and driver endpoints, and anonymous users from everything', async () => {
    const { agent } = await register();
    expect((await agent.get('/api/v1/admin/users')).status).toBe(403);
    expect((await agent.get('/api/v1/drivers/me')).status).toBe(403);
    expect((await request(app).get('/api/v1/admin/users')).status).toBe(401);
  });

  it('allows admins to list users with search and pagination', async () => {
    await seedUser('boss@example.com', 'ADMIN');
    await register();
    const { agent } = await signIn('boss@example.com');
    const all = await agent.get('/api/v1/admin/users?pageSize=1');
    expect(all.status).toBe(200);
    expect(all.body.data).toMatchObject({ page: 1, pageSize: 1, total: 2 });
    expect(all.body.data.items).toHaveLength(1);
    expect(JSON.stringify(all.body)).not.toContain('passwordHash');
    const found = await agent.get('/api/v1/admin/users?search=thandi');
    expect(found.body.data.total).toBe(1);
  });

  it('uses the database role, so a tampered cookie or header cannot elevate privileges', async () => {
    const { agent } = await register();
    const res = await agent.get('/api/v1/admin/users').set('X-Role', 'ADMIN').set('Cookie', 'role=ADMIN');
    expect(res.status).toBe(403);
  });

  it('returns only the signed-in passenger’s own profile', async () => {
    const a = await register({ email: 'a@example.com', fullName: 'Passenger A' });
    const b = await register({ email: 'b@example.com', fullName: 'Passenger B' });
    expect((await a.agent.get('/api/v1/passengers/me')).body.data.user.fullName).toBe('Passenger A');
    expect((await b.agent.get('/api/v1/passengers/me')).body.data.user.fullName).toBe('Passenger B');
  });
});

describe('profile and password management', () => {
  it('updates the profile and rejects unknown fields (role cannot be changed here)', async () => {
    const { agent, csrf } = await register();
    const ok = await agent.patch('/api/v1/users/me').set('X-CSRF-Token', csrf).send({ fullName: 'Thandi N.' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.user.fullName).toBe('Thandi N.');
    const bad = await agent.patch('/api/v1/users/me').set('X-CSRF-Token', csrf).send({ role: 'ADMIN' });
    expect(bad.status).toBe(400);
    expect(fake.current.users[0]!.role).toBe('PASSENGER');
  });

  it('changes the password only with the correct current password, and signs out other sessions', async () => {
    await register();
    const first = await signIn('thandi@example.com');
    const second = await signIn('thandi@example.com');
    const wrong = await first.agent.post('/api/v1/users/me/change-password').set('X-CSRF-Token', first.csrf).send({ currentPassword: 'nope-nope-1', newPassword: 'Another2026pass' });
    expect(wrong.status).toBe(400);
    const ok = await first.agent.post('/api/v1/users/me/change-password').set('X-CSRF-Token', first.csrf).send({ currentPassword: PASSWORD, newPassword: 'Another2026pass' });
    expect(ok.status).toBe(200);
    expect((await first.agent.get('/api/v1/auth/me')).status).toBe(200);
    expect((await second.agent.get('/api/v1/auth/me')).status).toBe(401);
    expect((await signIn('thandi@example.com', 'Another2026pass')).res.status).toBe(200);
  });
});

describe('password reset (development flow)', () => {
  it('issues a single-use link, updates the password and signs out all sessions', async () => {
    const { agent } = await register();
    const forgot = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'thandi@example.com' });
    expect(forgot.status).toBe(200);
    const token = new URL(forgot.body.data.devResetPath, 'http://x').searchParams.get('token')!;
    expect(fake.current.resets[0]!.tokenHash).not.toContain(token); // only a hash is stored

    const reset = await request(app).post('/api/v1/auth/reset-password').send({ token, password: 'BrandNew2026pw' });
    expect(reset.status).toBe(200);
    expect((await agent.get('/api/v1/auth/me')).status).toBe(401);
    expect((await signIn('thandi@example.com', 'BrandNew2026pw')).res.status).toBe(200);
    const reuse = await request(app).post('/api/v1/auth/reset-password').send({ token, password: 'Different2026pw' });
    expect(reuse.status).toBe(400);
  });

  it('returns the same status for unknown emails and rejects expired or invalid tokens', async () => {
    const unknown = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'ghost@example.com' });
    expect(unknown.status).toBe(200);
    expect(unknown.body.data.devResetPath).toBeUndefined();
    await register();
    const forgot = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'thandi@example.com' });
    const token = new URL(forgot.body.data.devResetPath, 'http://x').searchParams.get('token')!;
    fake.current.resets[0]!.expiresAt = new Date(Date.now() - 1000);
    expect((await request(app).post('/api/v1/auth/reset-password').send({ token, password: 'BrandNew2026pw' })).status).toBe(400);
    expect((await request(app).post('/api/v1/auth/reset-password').send({ token: 'x'.repeat(30), password: 'BrandNew2026pw' })).status).toBe(400);
  });
});
