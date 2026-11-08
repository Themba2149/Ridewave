import { adminRepository as admin } from '../repositories/admin.repository';
import { settingsRepository as repo } from '../repositories/settings.repository';
import { SETTING_DEFAULTS, SETTING_KEYS, SETTING_LIMITS, type PlatformSettings, type SettingKey } from '../types/platform';
import { logger } from '../utils/logger';

export type SettingsResult = { values: PlatformSettings; overridden: SettingKey[] };
const CACHE_MS = 5000;
let cache: { at: number; data: SettingsResult } | null = null;
let warned = false;
export const resetSettingsCache = () => { cache = null; warned = false; };

/**
 * Current settings: built-in defaults overlaid with any administrator overrides.
 * If the settings table is unavailable (for example the migration has not been run yet) the defaults are used and a warning is logged,
 * so the rest of the platform keeps working.
 */
export async function getSettings(): Promise<SettingsResult> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.data;
  let stored: Record<string, string> = {};
  try {
    stored = await repo.all();
  } catch (err) {
    if (!warned) { warned = true; logger.warn({ err }, 'Platform settings unavailable; using defaults. Run: npm run db:migrate'); }
  }
  const values = { ...SETTING_DEFAULTS };
  const overridden: SettingKey[] = [];
  for (const key of SETTING_KEYS) {
    const n = Number(stored[key]);
    const [lo, hi] = SETTING_LIMITS[key];
    if (stored[key] !== undefined && Number.isInteger(n) && n >= lo && n <= hi) { values[key] = n; overridden.push(key); }
  }
  const data = { values, overridden };
  cache = { at: Date.now(), data };
  return data;
}

export async function updateSettings(actorId: string, changes: Partial<PlatformSettings>, ip?: string): Promise<SettingsResult> {
  const before = (await getSettings()).values;
  const entries = Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]));
  const from: Record<string, unknown> = {};
  const to: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(changes)) if (v !== undefined && before[k as SettingKey] !== v) { from[k] = before[k as SettingKey]; to[k] = v; }
  await repo.upsertMany(entries, actorId);
  resetSettingsCache();
  await admin.recordAudit({ actorId, action: 'SETTINGS_UPDATED', entityType: 'PlatformSetting', entityId: null, metadata: { from, to }, ipAddress: ip ?? null });
  return getSettings();
}
