import type { Express } from 'express';
import request from 'supertest';
import { hashPassword } from '../../utils/password';
import { authWorld } from './fake-auth-repository';
import { world } from './fake-rides-repository';

export const PASSWORD = 'Sunrise2026x';
export const sandton = { address: 'Sandton City, Rivonia Rd, Sandton', lat: -26.1076, lng: 28.0567 };
export const airport = { address: 'OR Tambo International Airport, Kempton Park', lat: -26.1337, lng: 28.242 };
export const MELROSE = { lat: -26.1347, lng: 28.0687 };

const csrfOf = (res: request.Response) => decodeURIComponent(([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith('ridewave.csrf='))!.split(';')[0]!.split('=')[1]!);
export const cookieHeader = (res: request.Response) => ([] as string[]).concat(res.headers['set-cookie'] ?? []).map((c) => c.split(';')[0]).join('; ');

/** Small test client helpers shared by the newer test files. The app must be created after the repositories are mocked. */
export function kit(app: Express) {
  let keySeq = 0;
  function client(agent: request.Agent, csrf: string, userId: string, cookie: string) {
    return {
      agent, userId, cookie, csrf,
      get: (url: string) => agent.get(url),
      post: (url: string, body: object = {}) => agent.post(url).set('X-CSRF-Token', csrf).send(body),
      patch: (url: string, body: object) => agent.patch(url).set('X-CSRF-Token', csrf).send(body),
      del: (url: string) => agent.delete(url).set('X-CSRF-Token', csrf),
    };
  }
  type Client = ReturnType<typeof client>;
  async function signUp(email: string, role: 'PASSENGER' | 'DRIVER' = 'PASSENGER') {
    const agent = request.agent(app);
    const res = await agent.post('/api/v1/auth/register').send({ role, fullName: `Name ${email.split('@')[0]}`, email, password: PASSWORD });
    return client(agent, csrfOf(res), authWorld.users.find((u) => u.email === email)!.id, cookieHeader(res));
  }
  async function makeDriver(email: string, opts: Parameters<typeof world.addDriver>[1] = {}) {
    const c = await signUp(email, 'DRIVER');
    return Object.assign(c, { state: world.addDriver(c.userId, { name: `Driver ${email.split('@')[0]}`, ...MELROSE, ...opts }) });
  }
  async function makeAdmin(email = 'boss@example.com') {
    const u = await authWorld.repo.createUserWithProfile({ email, phone: null, fullName: 'The Boss', passwordHash: await hashPassword(PASSWORD), role: 'PASSENGER' });
    u.role = 'ADMIN';
    const agent = request.agent(app);
    const res = await agent.post('/api/v1/auth/login').send({ email, password: PASSWORD });
    return client(agent, csrfOf(res), u.id, cookieHeader(res));
  }
  const book = (p: Client, over: object = {}) => p.post('/api/v1/rides', { pickup: sandton, dropoff: airport, categoryCode: 'ECONOMY', idempotencyKey: `key-${++keySeq}-abcdefgh`, ...over });
  /** Books a ride and drives it to COMPLETED. Returns the ride id. */
  async function completedRide(p: Client, d: Client) {
    const id = (await book(p)).body.data.ride.id as string;
    for (const step of ['accept', 'arrive', 'start', 'complete']) {
      const r = await d.post(`/api/v1/rides/${id}/${step}`);
      if (r.status !== 200) throw new Error(`step ${step} failed: ${r.status} ${JSON.stringify(r.body)}`);
    }
    return id;
  }
  return { signUp, makeDriver, makeAdmin, book, completedRide };
}
export type Kit = ReturnType<typeof kit>;
