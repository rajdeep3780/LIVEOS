import type { NotificationItem } from '../types/lifeos.ts';
import { api } from './api.ts';

export async function fetchNotifications(): Promise<{
  items: NotificationItem[];
  unreadCount: number;
}> {
  const { data } = await api.get<{
    items: NotificationItem[];
    unreadCount: number;
  }>('/notifications');
  return data;
}

export async function markNotificationRead(id: string): Promise<void> {
  await api.patch(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.patch('/notifications/read-all');
}
