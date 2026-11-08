import bcrypt from 'bcryptjs';
import { env } from '../config/env';

// bcrypt (pure JS implementation: installs cleanly on Windows). Low cost only in tests for speed.
const COST = env.NODE_ENV === 'test' ? 4 : 12;

export const hashPassword = (plain: string) => bcrypt.hash(plain, COST);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

let dummyHash: Promise<string> | undefined;
/** Spend comparable time when the account does not exist, so response timing does not reveal which emails are registered. */
export async function burnPasswordCheck(plain: string): Promise<void> {
  dummyHash ??= bcrypt.hash('not-a-real-password', COST);
  await bcrypt.compare(plain, await dummyHash);
}
