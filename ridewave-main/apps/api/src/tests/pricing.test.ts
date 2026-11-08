import { describe, expect, it } from 'vitest';
import { calculateFare } from '../services/pricing.service';
import type { FareConfig } from '../types/ride';

const cfg: FareConfig = {
  currency: 'ZAR', baseFareMinor: 1500, perKmMinor: 750, perMinuteMinor: 900, minimumFareMinor: 3000, bookingFeeMinor: 500,
  demandMultiplierBp: 10000, roundingMinor: 100, cancellationFeeMinor: 2000, freeCancelWindowSeconds: 120,
};

describe('calculateFare', () => {
  it('adds base, distance, time and booking fee, then rounds up to the next rand', () => {
    // 10 km at R7.50 = 7500; 20 min at R9.00 = 18000 -> 1500+7500+18000+500 = 27500 (R275.00)
    const f = calculateFare(cfg, 10_000, 1200);
    expect(f).toMatchObject({ distanceChargeMinor: 7500, timeChargeMinor: 18000, bookingFeeMinor: 500, totalMinor: 27500, roundingAdjustmentMinor: 0, minimumFareTopUpMinor: 0 });
  });

  it('rounds the total UP to the rounding step and reports the adjustment', () => {
    // 1234 m -> 925.5 -> 926 (half up); 100 s -> 1500; 1500+926+1500+500 = 4426 -> rounds up to 4500
    const f = calculateFare(cfg, 1234, 100);
    expect(f.distanceChargeMinor).toBe(926);
    expect(f.timeChargeMinor).toBe(1500);
    expect(f.totalMinor).toBe(4500);
    expect(f.roundingAdjustmentMinor).toBe(74);
  });

  it('applies the minimum fare and shows the top-up separately', () => {
    // very short trip: 200 m, 60 s -> 1500+150+900+500 = 3050 which is above 3000, so use a higher minimum
    const f = calculateFare({ ...cfg, minimumFareMinor: 5000 }, 200, 60);
    expect(f.minimumFareTopUpMinor).toBe(5000 - (1500 + 150 + 900 + 500));
    expect(f.totalMinor).toBe(5000);
  });

  it('applies a demand multiplier to the pre-fee subtotal', () => {
    const f = calculateFare({ ...cfg, demandMultiplierBp: 15000 }, 10_000, 1200); // 1.5x on 27000 subtotal
    expect(f.demandAdjustmentMinor).toBe(13500);
    expect(f.totalMinor).toBe(1500 + 7500 + 18000 + 13500 + 500);
  });

  it('only ever returns integers, and total equals the sum of its parts', () => {
    for (const [d, t] of [[1, 1], [999, 59], [12_345, 1_777], [499_999, 86_399]] as const) {
      const f = calculateFare({ ...cfg, demandMultiplierBp: 12345 }, d, t);
      for (const v of Object.values(f)) if (typeof v === 'number') expect(Number.isInteger(v)).toBe(true);
      const parts = f.baseFareMinor + f.distanceChargeMinor + f.timeChargeMinor + f.demandAdjustmentMinor + f.bookingFeeMinor + f.minimumFareTopUpMinor + f.roundingAdjustmentMinor;
      expect(parts).toBe(f.totalMinor);
      expect(f.totalMinor % cfg.roundingMinor).toBe(0);
    }
  });

  it('rejects invalid distance and duration', () => {
    for (const [d, t] of [[0, 600], [-5, 600], [1000.5, 600], [NaN, 600], [Infinity, 600], [600_000, 600], [1000, 0], [1000, -1], [1000, 90_000]]) {
      expect(() => calculateFare(cfg, d as number, t as number)).toThrow();
    }
  });

  it('rejects an invalid fare configuration instead of charging a wrong amount', () => {
    expect(() => calculateFare({ ...cfg, perKmMinor: -1 }, 1000, 600)).toThrow();
    expect(() => calculateFare({ ...cfg, demandMultiplierBp: 9000 }, 1000, 600)).toThrow();
    expect(() => calculateFare({ ...cfg, roundingMinor: 0 }, 1000, 600)).toThrow();
  });
});
