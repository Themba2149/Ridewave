import { describe, expect, it } from 'vitest';
import { registerSchema, tripPreviewSchema } from './validators';

const valid = { role: 'PASSENGER', fullName: 'Thandi Nkosi', email: 'thandi@example.com', phone: '', password: 'Sunrise2026x', confirmPassword: 'Sunrise2026x' };

describe('registerSchema', () => {
  it('accepts a valid passenger registration', () => expect(registerSchema.safeParse(valid).success).toBe(true));
  it('rejects mismatched passwords', () => expect(registerSchema.safeParse({ ...valid, confirmPassword: 'other' }).success).toBe(false));
  it('rejects weak passwords', () => {
    expect(registerSchema.safeParse({ ...valid, password: 'short1', confirmPassword: 'short1' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, password: 'onlyletterslong', confirmPassword: 'onlyletterslong' }).success).toBe(false);
  });
  it('does not accept an ADMIN role', () => expect(registerSchema.safeParse({ ...valid, role: 'ADMIN' }).success).toBe(false));
});

describe('tripPreviewSchema', () => {
  it('requires different pickup and destination', () => expect(tripPreviewSchema.safeParse({ pickup: 'Sandton', destination: 'sandton' }).success).toBe(false));
});
