import { create } from 'zustand';
import type { NotificationItem } from '@/types';
import {
  mapApiNotificationToItem,
  notificationsList,
  notificationMarkRead,
  notificationMarkAllRead,
  notificationDelete,
} from '@/lib/notificationsApi';

interface NotificationState {
  notifications: NotificationItem[];
  refreshNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  remove: (id: string) => Promise<void>;
  setNotifications: (items: NotificationItem[]) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  refreshNotifications: async () => {
    try {
      const rows = await notificationsList(100);
      set({ notifications: rows.map(mapApiNotificationToItem) });
    } catch {
      /* mantener lista actual si falla la red */
    }
  },
  markAsRead: async (id) => {
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n,
      ),
    }));
    try {
      const row = await notificationMarkRead(id);
      set((s) => ({
        notifications: s.notifications.map((n) =>
          n.id === id ? mapApiNotificationToItem(row) : n,
        ),
      }));
    } catch {
      await get().refreshNotifications();
    }
  },
  markAllAsRead: async () => {
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
    }));
    try {
      await notificationMarkAllRead();
    } catch {
      await get().refreshNotifications();
    }
  },
  remove: async (id) => {
    set((s) => ({
      notifications: s.notifications.filter((n) => n.id !== id),
    }));
    try {
      await notificationDelete(id);
    } catch {
      await get().refreshNotifications();
    }
  },
  setNotifications: (items) => set({ notifications: items }),
}));
