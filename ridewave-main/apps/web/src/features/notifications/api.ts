import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api-client';

export type Notification = { id: string; type: string; title: string; body: string; readAt: string | null; createdAt: string };
export type NotificationPage = { items: Notification[]; total: number; unread: number; page: number; pageSize: number };

export const useNotificationList = (page: number, unreadOnly: boolean) =>
  useQuery({ queryKey: ['notifications', 'list', page, unreadOnly], queryFn: () => apiFetch<NotificationPage>(`/notifications?page=${page}&pageSize=15&unread=${unreadOnly}`), placeholderData: keepPreviousData });

/** Unread count for the bell. Kept fresh by live events, with a slow poll as the fallback. */
export const useUnreadCount = () =>
  useQuery({ queryKey: ['notifications', 'unread'], queryFn: async () => (await apiFetch<NotificationPage>('/notifications?pageSize=1')).unread, refetchInterval: 60_000 });

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => apiFetch(`/notifications/${id}/read`, { method: 'POST' }), onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });
}
export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => apiFetch('/notifications/read-all', { method: 'POST' }), onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });
}
