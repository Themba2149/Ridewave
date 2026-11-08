import { notificationsRepository as repo } from '../repositories/notifications.repository';
import { logger } from '../utils/logger';
import { emitToUser } from './realtime.service';

/**
 * In-app notifications. Sending one is a side effect: if it fails the ride or payment it describes must still succeed, so errors are logged, not thrown.
 * External channels (SMS, email) are not connected: the EMAIL_PROVIDER=dev adapter does not send anything.
 */
export async function notify(userId: string, n: { type: string; title: string; body: string }): Promise<void> {
  try {
    const row = await repo.create({ userId, ...n });
    emitToUser(userId, 'notification:new', { id: row.id, type: n.type, title: n.title });
  } catch (err) {
    logger.warn({ err, userId, type: n.type }, 'Could not store notification');
  }
}

export async function broadcast(audience: 'ALL' | 'PASSENGER' | 'DRIVER', n: { title: string; body: string }): Promise<number> {
  const ids = await repo.activeUserIds(audience);
  if (ids.length === 0) return 0;
  const count = await repo.createMany(ids, { type: 'ANNOUNCEMENT', ...n });
  for (const id of ids) emitToUser(id, 'notification:new', { type: 'ANNOUNCEMENT', title: n.title });
  return count;
}

export const listNotifications = (userId: string, q: { page: number; pageSize: number; unreadOnly: boolean }) => repo.list(userId, q);
export const markNotificationRead = (userId: string, id: string) => repo.markRead(userId, id);
export const markAllNotificationsRead = (userId: string) => repo.markAllRead(userId);
