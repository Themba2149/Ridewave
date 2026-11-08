import { describe, expect, it } from 'vitest';
import { formatMinorAsRand } from './formatters';

describe('formatMinorAsRand', () => {
  it('formats cents as rand with two decimals', () => {
    expect(formatMinorAsRand(3050).replace(/\s/g, '')).toMatch(/^R30[.,]50$/);
    expect(formatMinorAsRand(0).replace(/\s/g, '')).toMatch(/^R0[.,]00$/);
  });
});

import { formatDistance, formatDuration } from './formatters';
describe('trip formatters', () => {
  it('formats distance and duration', () => {
    expect(formatDistance(850)).toBe('850 m');
    expect(formatDistance(12_345)).toBe('12.3 km');
    expect(formatDuration(1_199)).toBe('20 min');
    expect(formatDuration(5)).toBe('1 min');
  });
});
