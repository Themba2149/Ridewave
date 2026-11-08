import { prisma } from '../config/database';

export type NotificationRow = { id: string; type: string; title: string; body: string; readAt: Date | null; createdAt: Date };
export interface NotificationsRepository {
  create(n: { userId: string; type: string; title: string; body: string }): Promise<NotificationRow>;
  createMany(userIds: string[], n: { type: string; title: string; body: string }): Promise<number>;
  list(userId: string, q: { page: number; pageSize: number; unreadOnly: boolean }): Promise<{ items: NotificationRow[]; total: number; unread: number }>;
  markRead(userId: string, id: string): Promise<boolean>;
  markAllRead(userId: string): Promise<number>;
  activeUserIds(audience: 'ALL' | 'PASSENGER' | 'DRIVER'): Promise<string[]>;
}
const select = { id: true, type: true, title: true, body: true, readAt: true, createdAt: true } as const;

export const notificationsRepository: NotificationsRepository = {
  create: (n) => prisma.notification.create({ data: n, select }),
  async createMany(userIds, n) { return (await prisma.notification.createMany({ data: userIds.map((userId) => ({ userId, ...n })) })).count; },
  async list(userId, { page, pageSize, unreadOnly }) {
    const where = { userId, ...(unreadOnly ? { readAt: null } : {}) };
    const [items, total, unread] = await Promise.all([
      prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize, select }),
      prisma.notification.count({ where }), prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return { items, total, unread };
  },
  async markRead(userId, id) { return (await prisma.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } })).count > 0; }, // scoped to the owner
  async markAllRead(userId) { return (await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } })).count; },
  async activeUserIds(audience) {
    const rows = await prisma.user.findMany({ where: { status: 'ACTIVE', role: audience === 'ALL' ? { in: ['PASSENGER', 'DRIVER'] } : audience }, select: { id: true } });
    return rows.map((r) => r.id);
  },
};
