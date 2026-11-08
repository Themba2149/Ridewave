export type PlatformSettings = { driverCommissionBp: number; offerTtlSeconds: number; searchTimeoutSeconds: number; maxPickupRadiusMeters: number };
export type SettingKey = keyof PlatformSettings;

/** Built-in values used until an administrator overrides them. Commission is a demonstration value, not a real rate. */
export const SETTING_DEFAULTS: PlatformSettings = { driverCommissionBp: 2000, offerTtlSeconds: 60, searchTimeoutSeconds: 60, maxPickupRadiusMeters: 15_000 };
export const SETTING_LIMITS: Record<SettingKey, readonly [number, number]> = {
  driverCommissionBp: [0, 5000], offerTtlSeconds: [10, 300], searchTimeoutSeconds: [10, 600], maxPickupRadiusMeters: [1000, 50_000],
};
export const SETTING_KEYS = Object.keys(SETTING_DEFAULTS) as SettingKey[];
