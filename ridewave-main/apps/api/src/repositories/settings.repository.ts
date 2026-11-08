import { prisma } from '../config/database';

export interface SettingsRepository {
  all(): Promise<Record<string, string>>;
  upsertMany(entries: Record<string, string>, updatedById: string): Promise<void>;
}

export const settingsRepository: SettingsRepository = {
  async all() {
    const rows = await prisma.platformSetting.findMany();
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  },
  async upsertMany(entries, updatedById) {
    await prisma.$transaction(Object.entries(entries).map(([key, value]) => prisma.platformSetting.upsert({ where: { key }, update: { value, updatedById }, create: { key, value, updatedById } })));
  },
};
