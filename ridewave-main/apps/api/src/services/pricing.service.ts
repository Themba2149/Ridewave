import type { FareBreakdown, FareConfig } from '../types/ride';
import { AppError } from '../utils/errors';

export const MAX_DISTANCE_METERS = 500_000;
export const MAX_DURATION_SECONDS = 24 * 3600;

const isNonNegativeInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0;
/** Integer division rounded half-up (non-negative operands). No floating-point money maths. */
const divRound = (n: number, d: number) => Math.floor((2 * n + d) / (2 * d));
const roundUpTo = (value: number, step: number) => Math.floor((value + step - 1) / step) * step;

/**
 * Estimated fare = base + distance + time (+ demand adjustment) + booking fee, raised to the minimum fare,
 * then rounded UP to the configured step. Everything is in integer cents.
 */
export function calculateFare(config: FareConfig, distanceMeters: number, durationSeconds: number): FareBreakdown {
  if (!isNonNegativeInt(distanceMeters) || distanceMeters <= 0 || distanceMeters > MAX_DISTANCE_METERS) {
    throw AppError.validation('Trip distance is invalid.');
  }
  if (!isNonNegativeInt(durationSeconds) || durationSeconds <= 0 || durationSeconds > MAX_DURATION_SECONDS) {
    throw AppError.validation('Trip duration is invalid.');
  }
  const money = [config.baseFareMinor, config.perKmMinor, config.perMinuteMinor, config.minimumFareMinor, config.bookingFeeMinor];
  if (!money.every(isNonNegativeInt) || !Number.isInteger(config.demandMultiplierBp) || config.demandMultiplierBp < 10_000 || !Number.isInteger(config.roundingMinor) || config.roundingMinor < 1) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Fare configuration is invalid.');
  }

  const distanceChargeMinor = divRound(config.perKmMinor * distanceMeters, 1000);
  const timeChargeMinor = divRound(config.perMinuteMinor * durationSeconds, 60);
  const subtotal = config.baseFareMinor + distanceChargeMinor + timeChargeMinor;
  const demandAdjustmentMinor = divRound(subtotal * (config.demandMultiplierBp - 10_000), 10_000);
  const beforeMinimum = subtotal + demandAdjustmentMinor + config.bookingFeeMinor;
  const minimumFareTopUpMinor = Math.max(0, config.minimumFareMinor - beforeMinimum);
  const beforeRounding = beforeMinimum + minimumFareTopUpMinor;
  const totalMinor = roundUpTo(beforeRounding, config.roundingMinor);

  return {
    currency: config.currency, baseFareMinor: config.baseFareMinor, distanceChargeMinor, timeChargeMinor, demandAdjustmentMinor,
    bookingFeeMinor: config.bookingFeeMinor, minimumFareTopUpMinor, roundingAdjustmentMinor: totalMinor - beforeRounding,
    totalMinor, distanceMeters, durationSeconds,
  };
}
