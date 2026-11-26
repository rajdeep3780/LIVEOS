import { Bell, CheckCheck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppLayout } from '../../layouts/AppLayout.tsx';
import { formatDateTime } from '../../lib/date.ts';
import { extractErrorMessage } from '../../services/api.ts';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../services/notificationService.ts';
import type { NotificationItem } from '../../types/lifeos.ts';

export function NotificationsPage() {
  const { refreshUnreadCount } = useAppLayout();

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetchNotifications();
      setItems(res.items);
      setUnreadCount(res.unreadCount);
    } catch (err) {
      setError(extractErrorMessage(err, 'Unable to load notifications.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleMarkRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      setItems((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, readAt: new Date().toISOString() } : n
        )
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      refreshUnreadCount();
    } catch (err) {
      setError(extractErrorMessage(err, 'Unable to mark notification as read.'));
    }
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await markAllNotificationsRead();
      const now = new Date().toISOString();
      setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || now })));
      setUnreadCount(0);
      refreshUnreadCount();
    } catch (err) {
      setError(extractErrorMessage(err, 'Unable to mark notifications as read.'));
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-display text-xl font-semibold text-white">
            Notifications
          </h2>
          <p className="mt-0.5 text-sm text-[#9CA3AF]">
            Assignments, space invitations, and updates on Matters you follow.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={markingAll}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#2B2E38] bg-[#14161A] px-3.5 py-2 text-xs font-medium text-white transition-colors hover:border-[#3A3F4C] hover:bg-[#191C22] disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <CheckCheck className="h-3.5 w-3.5 text-[#F97316]" />
            <span>{markingAll ? 'Updating...' : 'Mark all read'}</span>
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-[#522424] bg-[#211315] p-4 text-sm text-[#FCA5A5]">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-lg border border-[#23262E] bg-[#14161A]"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-[#23262E] bg-[#14161A] px-6 py-12 text-center">
          <Bell className="mx-auto h-6 w-6 text-[#6B7280]" />
          <p className="mt-2 font-display text-sm font-medium text-white">
            No notifications yet
          </p>
          <p className="mt-1 text-xs text-[#9CA3AF]">
            You will be notified when Matters are assigned to you or updated in
            shared spaces.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[#23262E] bg-[#14161A] divide-y divide-[#20232B]">
          {items.map((item) => {
            const isUnread = item.readAt === null;
            return (
              <div
                key={item.id}
                className={`flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center ${
                  isUnread ? 'bg-[#181B22]' : ''
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#9CA3AF]">
                    {isUnread && (
                      <span className="font-medium text-[#F97316]">Unread</span>
                    )}
                    {item.spaceName && (
                      <>
                        {isUnread && <span aria-hidden="true">·</span>}
                        <span>{item.spaceName}</span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {formatDateTime(item.createdAt)}
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-white">{item.message}</p>

                  {item.matterId && (
                    <Link
                      to={`/matters/${item.matterId}`}
                      onClick={() => {
                        if (isUnread) handleMarkRead(item.id);
                      }}
                      className="mt-1.5 inline-block text-xs font-medium text-[#F97316] hover:text-[#FB923C]"
                    >
                      Open Matter: {item.matterTitle || 'View details'}
                    </Link>
                  )}
                </div>

                {isUnread && (
                  <button
                    type="button"
                    onClick={() => handleMarkRead(item.id)}
                    className="shrink-0 rounded-md border border-[#2B2E38] bg-[#111317] px-3 py-1.5 text-xs font-medium text-[#CBD5E1] hover:text-white"
                  >
                    Mark read
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
