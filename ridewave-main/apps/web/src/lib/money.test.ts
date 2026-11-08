import { describe, expect, it } from 'vitest';
import { bpToInput, bpToPercentInput, minorToInput, parseMoneyToMinor, parseMultiplierToBp, parsePercentToBp } from './money';

describe('money parsing (no floating point)', () => {
  it('converts rand text to cents exactly', () => {
    expect(parseMoneyToMinor('15')).toBe(1500);
    expect(parseMoneyToMinor('7.5')).toBe(750);
    expect(parseMoneyToMinor('7.50')).toBe(750);
    expect(parseMoneyToMinor('0.07')).toBe(7);
    expect(parseMoneyToMinor('19.99')).toBe(1999); // 19.99 * 100 would be 1998.9999999999998 with floats
    expect(parseMoneyToMinor(' 8.10 ')).toBe(810);
  });
  it('rejects invalid input', () => {
    for (const bad of ['', '-1', '1.234', 'abc', '1,50', '1.', '.5', '12345678']) expect(parseMoneyToMinor(bad)).toBeNull();
  });
  it('converts multipliers to basis points', () => {
    expect(parseMultiplierToBp('1')).toBe(10000);
    expect(parseMultiplierToBp('1.25')).toBe(12500);
    expect(parseMultiplierToBp('1.5')).toBe(15000);
    expect(parseMultiplierToBp('x')).toBeNull();
  });
  it('round-trips for display', () => {
    expect(minorToInput(1999)).toBe('19.99');
    expect(minorToInput(5)).toBe('0.05');
    expect(bpToInput(12500)).toBe('1.25');
    expect(bpToInput(10000)).toBe('1.00');
  });
});

describe('percent parsing', () => {
  it('converts percent to basis points exactly and caps at 50%', () => {
    expect(parsePercentToBp('20')).toBe(2000);
    expect(parsePercentToBp('12.5')).toBe(1250);
    expect(parsePercentToBp('0.07')).toBe(7);
    expect(parsePercentToBp('50')).toBe(5000);
    for (const bad of ['', '51', '-1', 'x', '1.234', '100']) expect(parsePercentToBp(bad)).toBeNull();
    expect(bpToPercentInput(2000)).toBe('20.00');
  });
});
