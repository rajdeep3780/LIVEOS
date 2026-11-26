import { listUserSpaces } from './spaceService.ts';
import { getGlobalTimeline, listMatters } from './matterService.ts';
import { listNotifications } from './notificationService.ts';

export async function getDashboardData(userId: string) {
  try {
    const [spaces, allMatters, recentActivity, notifData] = await Promise.all([
      listUserSpaces(userId),
      listMatters(userId, { includeArchived: false }),
      getGlobalTimeline(userId, { limit: 10 }),
      listNotifications(userId),
    ]);

    const counts = {
      open: 0,
      inProgress: 0,
      waiting: 0,
      completed: 0,
    };

    for (const m of allMatters) {
      if (m.status === 'Open') counts.open += 1;
      else if (m.status === 'In Progress') counts.inProgress += 1;
      else if (m.status === 'Waiting') counts.waiting += 1;
      else if (m.status === 'Completed') counts.completed += 1;
    }

    const activeMatters = allMatters.filter(
      (m) => m.status !== 'Completed' && m.status !== 'Archived'
    );

    const priorityRank: Record<string, number> = { High: 0, Normal: 1, Low: 2 };

    const myMatters = activeMatters
      .filter((m) => m.ownerId === userId)
      .sort((a, b) => {
        const pDiff = (priorityRank[a.priority] ?? 1) - (priorityRank[b.priority] ?? 1);
        if (pDiff !== 0) return pDiff;
        const aTime = a.nextActionAt ? new Date(a.nextActionAt).getTime() : Infinity;
        const bTime = b.nextActionAt ? new Date(b.nextActionAt).getTime() : Infinity;
        return aTime - bTime;
      });

    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    type AttentionItem = (typeof activeMatters)[number] & {
      attentionReason:
        | 'overdue_followup'
        | 'upcoming_followup'
        | 'waiting_followup'
        | 'pending_action';
    };

    const needsAttention: AttentionItem[] = [];

    for (const m of activeMatters) {
      const followUpTime = m.nextActionAt
        ? new Date(m.nextActionAt).getTime()
        : m.dueAt
        ? new Date(m.dueAt).getTime()
        : null;

      if (followUpTime !== null && followUpTime < now) {
        needsAttention.push({ ...m, attentionReason: 'overdue_followup' });
      } else if (followUpTime !== null && followUpTime <= now + sevenDaysMs) {
        needsAttention.push({ ...m, attentionReason: 'upcoming_followup' });
      } else if (m.status === 'Waiting') {
        needsAttention.push({ ...m, attentionReason: 'waiting_followup' });
      } else if (m.nextAction) {
        needsAttention.push({ ...m, attentionReason: 'pending_action' });
      }
    }

    const reasonOrder: Record<AttentionItem['attentionReason'], number> = {
      overdue_followup: 0,
      upcoming_followup: 1,
      waiting_followup: 2,
      pending_action: 3,
    };

    needsAttention.sort((a, b) => {
      const rDiff = reasonOrder[a.attentionReason] - reasonOrder[b.attentionReason];
      if (rDiff !== 0) return rDiff;
      const aTime = a.nextActionAt ? new Date(a.nextActionAt).getTime() : Infinity;
      const bTime = b.nextActionAt ? new Date(b.nextActionAt).getTime() : Infinity;
      return aTime - bTime;
    });

    return {
      counts,
      myMatters: myMatters.slice(0, 8),
      needsAttention: needsAttention.slice(0, 8),
      recentActivity,
      spaces,
      unreadNotifications: notifData.unreadCount,
    };
  } catch (error) {
    console.error('Failed to assemble dashboard data:', error);
    throw new Error('Failed to load dashboard.', { cause: error });
  }
}
