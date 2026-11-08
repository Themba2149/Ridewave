/**
 * Parse text like "12", "12.5" or "12.50" into integer minor units (cents) without floating-point arithmetic.
 * Returns null for anything else (negative numbers, more than two decimals, letters).
 */
export function parseMoneyToMinor(text: string): number | null {
  const m = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(text.trim());
  return m ? Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0')) : null;
}
/** "1.25" -> 12500 basis points (10000 = 1.00x). */
export function parseMultiplierToBp(text: string): number | null {
  const m = /^(\d{1,2})(?:\.(\d{1,2}))?$/.exec(text.trim());
  return m ? Number(m[1]) * 10_000 + Number((m[2] ?? '').padEnd(2, '0')) * 100 : null;
}
export const minorToInput = (minor: number) => `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, '0')}`;
export const bpToInput = (bp: number) => `${Math.floor(bp / 10_000)}.${String(Math.round((bp % 10_000) / 100)).padStart(2, '0')}`;

/** "15" -> 1500, "12.5" -> 1250 (percent to basis points, exact). */
export function parsePercentToBp(text: string): number | null {
  const m = /^(\d{1,2})(?:\.(\d{1,2}))?$/.exec(text.trim());
  const bp = m ? Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0')) : null;
  return bp !== null && bp <= 5000 ? bp : null;
}
export const bpToPercentInput = (bp: number) => `${Math.floor(bp / 100)}.${String(bp % 100).padStart(2, '0')}`;
