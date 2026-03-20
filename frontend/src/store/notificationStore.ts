import { create } from 'zustand';
import type { NotificationItem } from '@/types';
import { notificationsData } from '@/data/notificationMock';

interface NotificationState {
  notifications: NotificationItem[];
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  remove: (id: string) => void;
  setNotifications: (items: NotificationItem[]) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: notificationsData,
  markAsRead: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n,
      ),
    })),
  markAllAsRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
    })),
  remove: (id) =>
    set((s) => ({
      notifications: s.notifications.filter((n) => n.id !== id),
    })),
  setNotifications: (items) => set({ notifications: items }),
}));
