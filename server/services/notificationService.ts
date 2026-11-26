import { and, count, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../../src/db/index.ts';
import {
  matters,
  notifications,
  spaceMemberships,
  spaces,
} from '../../src/db/schema.ts';
import { isValidUuid } from './spaceService.ts';

export async function listNotifications(userId: string) {
  try {
    const rows = await db
      .select({
        id: notifications.id,
        userId: notifications.userId,
        matterId: notifications.matterId,
        message: notifications.message,
        readAt: notifications.readAt,
        createdAt: notifications.createdAt,
        hasSpaceAccess: sql<boolean>`(${spaceMemberships.id} IS NOT NULL)`,
        matterTitle: matters.title,
        matterStatus: matters.status,
        spaceName: spaces.name,
      })
      .from(notifications)
      .leftJoin(matters, eq(notifications.matterId, matters.id))
      .leftJoin(spaces, eq(matters.spaceId, spaces.id))
      .leftJoin(
        spaceMemberships,
        and(
          eq(spaceMemberships.spaceId, matters.spaceId),
          eq(spaceMemberships.userId, userId)
        )
      )
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(50);

    const items = rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      matterId: row.hasSpaceAccess ? row.matterId : null,
      message: row.message,
      readAt: row.readAt,
      createdAt: row.createdAt,
      matterTitle: row.hasSpaceAccess ? row.matterTitle : null,
      matterStatus: row.hasSpaceAccess ? row.matterStatus : null,
      spaceName: row.hasSpaceAccess ? row.spaceName : null,
    }));

    const [unreadRow] = await db
      .select({ total: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));

    const unreadCount = Number(unreadRow?.total ?? 0);

    return {
      items,
      unreadCount,
    };
  } catch (error) {
    console.error('Database query failed in listNotifications:', error);
    throw new Error('Failed to load notifications.', { cause: error });
  }
}

export async function markNotificationRead(userId: string, notificationId: string) {
  if (!isValidUuid(notificationId)) {
    throw new Error('NOT_FOUND');
  }

  try {
    const [updated] = await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(eq(notifications.id, notificationId), eq(notifications.userId, userId))
      )
      .returning();

    if (!updated) throw new Error('NOT_FOUND');
    return updated;
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') throw error;
    console.error('Database query failed in markNotificationRead:', error);
    throw new Error('Failed to mark notification as read.', { cause: error });
  }
}

export async function markAllNotificationsRead(userId: string) {
  try {
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));

    return { updated: true };
  } catch (error) {
    console.error('Database query failed in markAllNotificationsRead:', error);
    throw new Error('Failed to mark all notifications as read.', { cause: error });
  }
}
