import { and, desc, eq, ilike, inArray, ne, or } from 'drizzle-orm';
import { db } from '../../src/db/index.ts';
import {
  matterParticipants,
  matters,
  matterUpdates,
  notifications,
  spaceMemberships,
  spaces,
  users,
} from '../../src/db/schema.ts';
import { getMembership, isValidUuid } from './spaceService.ts';
import type { DbClient } from './userService.ts';

export const MATTER_STATUSES = [
  'Open',
  'In Progress',
  'Waiting',
  'Completed',
  'Archived',
] as const;

export const MATTER_PRIORITIES = ['Low', 'Normal', 'High'] as const;

export type MatterStatus = (typeof MATTER_STATUSES)[number];
export type MatterPriority = (typeof MATTER_PRIORITIES)[number];

function parseOptionalDate(val: string | null | undefined): Date | null {
  if (!val) return null;
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) {
    throw new Error('VALIDATION: Invalid date format.');
  }
  return d;
}

function sameOptionalDate(a: Date | null | undefined, b: Date | null | undefined): boolean {
  const ta = a ? a.getTime() : null;
  const tb = b ? b.getTime() : null;
  return ta === tb;
}

function formatTimelineDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export const USER_ALLOWED_UPDATE_TYPES = ['note'] as const;

export interface MatterPermissions {
  canEditDetails: boolean;
  canChangeStatusPriority: boolean;
  canChangeOwnership: boolean;
  canManageParticipants: boolean;
  canArchiveRestore: boolean;
  canDelete: boolean;
  canPostUpdate: boolean;
}

export function computeMatterPermissions(
  userId: string,
  role: string,
  matter: { ownerId: string | null; createdBy: string | null; status: string }
): MatterPermissions {
  const isOwnerOrAdmin = role === 'owner' || role === 'admin';
  const isArchived = matter.status === 'Archived';
  const isMatterOwnerOrCreator =
    matter.ownerId === userId || matter.createdBy === userId;
  const isMatterCreator = matter.createdBy === userId;

  return {
    canEditDetails: isOwnerOrAdmin || (!isArchived && isMatterOwnerOrCreator),
    canChangeStatusPriority:
      isOwnerOrAdmin || (!isArchived && isMatterOwnerOrCreator),
    canChangeOwnership: isOwnerOrAdmin,
    canManageParticipants:
      isOwnerOrAdmin || (!isArchived && isMatterOwnerOrCreator),
    canArchiveRestore: isOwnerOrAdmin,
    canDelete: isOwnerOrAdmin || (!isArchived && isMatterCreator),
    canPostUpdate: !isArchived,
  };
}

async function hydrateMatters(
  matterRows: (typeof matters.$inferSelect)[],
  txClient: DbClient = db
) {
  if (matterRows.length === 0) return [];

  const spaceIds = [...new Set(matterRows.map((m) => m.spaceId))];
  const matterIds = matterRows.map((m) => m.id);
  const userIds = [
    ...new Set(
      matterRows
        .flatMap((m) => [m.ownerId, m.createdBy])
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const spaceRows = await txClient
    .select({ id: spaces.id, name: spaces.name, type: spaces.type })
    .from(spaces)
    .where(inArray(spaces.id, spaceIds));

  const participantRows = await txClient
    .select({
      matterId: matterParticipants.matterId,
      userId: users.id,
      displayName: users.displayName,
      email: users.email,
    })
    .from(matterParticipants)
    .innerJoin(users, eq(matterParticipants.userId, users.id))
    .where(inArray(matterParticipants.matterId, matterIds));

  const updateRows = await txClient
    .select({
      matterId: matterUpdates.matterId,
    })
    .from(matterUpdates)
    .where(inArray(matterUpdates.matterId, matterIds));

  const allUserIds = [
    ...new Set([...userIds, ...participantRows.map((p) => p.userId)]),
  ];

  const userRows =
    allUserIds.length > 0
      ? await txClient
          .select({
            id: users.id,
            displayName: users.displayName,
            email: users.email,
          })
          .from(users)
          .where(inArray(users.id, allUserIds))
      : [];

  const userMap = new Map(userRows.map((u) => [u.id, u]));
  const spaceMap = new Map(spaceRows.map((s) => [s.id, s]));

  return matterRows.map((m) => {
    const participants = participantRows
      .filter((p) => p.matterId === m.id)
      .map((p) => ({
        id: p.userId,
        displayName: p.displayName,
        email: p.email,
      }));
    const updateCount = updateRows.filter((u) => u.matterId === m.id).length;

    return {
      ...m,
      space: spaceMap.get(m.spaceId) || null,
      owner: m.ownerId ? userMap.get(m.ownerId) || null : null,
      creator: m.createdBy ? userMap.get(m.createdBy) || null : null,
      participants,
      updateCount,
    };
  });
}

export async function listMatters(
  userId: string,
  filters: {
    spaceId?: string;
    status?: string;
    priority?: string;
    assignedToMe?: boolean;
    search?: string;
    includeArchived?: boolean;
  }
) {
  try {
    const memberships = await db
      .select({ spaceId: spaceMemberships.spaceId })
      .from(spaceMemberships)
      .where(eq(spaceMemberships.userId, userId));

    const accessibleSpaceIds = memberships.map((m) => m.spaceId);
    if (accessibleSpaceIds.length === 0) return [];

    const conditions = [];

    if (filters.spaceId) {
      if (!isValidUuid(filters.spaceId) || !accessibleSpaceIds.includes(filters.spaceId)) {
        throw new Error('FORBIDDEN');
      }
      conditions.push(eq(matters.spaceId, filters.spaceId));
    } else {
      conditions.push(inArray(matters.spaceId, accessibleSpaceIds));
    }

    if (filters.status && filters.status !== 'All') {
      conditions.push(eq(matters.status, filters.status));
    } else if (!filters.includeArchived) {
      conditions.push(ne(matters.status, 'Archived'));
    }

    if (filters.priority && filters.priority !== 'All') {
      conditions.push(eq(matters.priority, filters.priority));
    }

    if (filters.assignedToMe) {
      conditions.push(eq(matters.ownerId, userId));
    }

    if (filters.search && filters.search.trim().length > 0) {
      const pattern = `%${filters.search.trim()}%`;
      conditions.push(
        or(
          ilike(matters.title, pattern),
          ilike(matters.description, pattern),
          ilike(matters.nextAction, pattern),
          ilike(matters.waitingFor, pattern),
          ilike(matters.category, pattern)
        )
      );
    }

    const rows = await db
      .select()
      .from(matters)
      .where(and(...conditions))
      .orderBy(desc(matters.updatedAt));

    return await hydrateMatters(rows);
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN') throw error;
    console.error('Database query failed in listMatters:', error);
    throw new Error('Failed to load matters.', { cause: error });
  }
}

export async function createMatter(
  userId: string,
  spaceId: string,
  input: {
    title: string;
    description?: string;
    category?: string;
    status?: string;
    priority?: string;
    ownerId?: string | null;
    waitingFor?: string | null;
    nextAction?: string | null;
    nextActionAt?: string | null;
    dueAt?: string | null;
    resolution?: string | null;
    participantIds?: string[];
  }
) {
  if (!isValidUuid(spaceId)) {
    throw new Error('NOT_FOUND');
  }

  const title = input.title?.trim();
  if (!title || title.length < 2 || title.length > 160) {
    throw new Error('VALIDATION: Title must be between 2 and 160 characters.');
  }

  const status = (input.status || 'Open') as MatterStatus;
  if (!MATTER_STATUSES.includes(status)) {
    throw new Error('VALIDATION: Invalid matter status.');
  }

  const priority = (input.priority || 'Normal') as MatterPriority;
  if (!MATTER_PRIORITIES.includes(priority)) {
    throw new Error('VALIDATION: Invalid matter priority.');
  }

  const waitingFor = status === 'Waiting' ? input.waitingFor?.trim() || null : null;
  if (status === 'Waiting' && !waitingFor) {
    throw new Error(
      'VALIDATION: Please specify who or what this matter is waiting for.'
    );
  }

  const resolution =
    status === 'Completed' || status === 'Archived'
      ? input.resolution?.trim() || null
      : null;
  if (status === 'Completed' && !resolution) {
    throw new Error(
      'VALIDATION: Please record a resolution before marking this matter completed.'
    );
  }

  const nextAction = input.nextAction?.trim() || null;
  const nextActionAt = parseOptionalDate(input.nextActionAt);
  const dueAt = parseOptionalDate(input.dueAt);

  try {
    return await db.transaction(async (tx) => {
      const membership = await getMembership(userId, spaceId, tx);
      if (!membership) throw new Error('FORBIDDEN');

      const isOwnerOrAdmin =
        membership.role === 'owner' || membership.role === 'admin';

      if (
        input.ownerId !== undefined &&
        input.ownerId !== null &&
        (typeof input.ownerId !== 'string' || input.ownerId.trim() === '')
      ) {
        throw new Error('VALIDATION: Assigned owner must be a valid member ID or null.');
      }

      if (!isOwnerOrAdmin) {
        if (input.ownerId && input.ownerId !== userId) {
          throw new Error('FORBIDDEN_ROLE');
        }
        if (status === 'Archived') {
          throw new Error('FORBIDDEN_ROLE');
        }
      }

      const spaceMembers = await tx
        .select({ userId: spaceMemberships.userId })
        .from(spaceMemberships)
        .where(eq(spaceMemberships.spaceId, spaceId));
      const memberSet = new Set(spaceMembers.map((m) => m.userId));

      const ownerId = input.ownerId || userId;
      if (!isValidUuid(ownerId) || !memberSet.has(ownerId)) {
        throw new Error('VALIDATION: Assigned owner must be a member of this space.');
      }

      const participantIds = [...new Set(input.participantIds || [])].filter(
        (id) => isValidUuid(id) && memberSet.has(id)
      );

      const [created] = await tx
        .insert(matters)
        .values({
          spaceId,
          createdBy: userId,
          ownerId,
          title,
          description: input.description?.trim() || '',
          category: input.category?.trim() || 'General',
          status,
          priority,
          waitingFor,
          nextAction,
          nextActionAt,
          dueAt,
          resolution,
          completedAt: status === 'Completed' ? new Date() : null,
        })
        .returning();

      if (participantIds.length > 0) {
        await tx
          .insert(matterParticipants)
          .values(
            participantIds.map((pid) => ({
              matterId: created.id,
              userId: pid,
            }))
          )
          .onConflictDoNothing();
      }

      const createdTimeline =
        status === 'Completed'
          ? {
              updateType: 'completed',
              message: `Matter opened and marked completed. Resolution: ${resolution}`,
            }
          : status === 'Waiting'
          ? {
              updateType: 'created',
              message: `Matter opened (Waiting for: ${waitingFor}).`,
            }
          : {
              updateType: 'created',
              message: nextAction
                ? `Matter opened with next action: "${nextAction}"`
                : 'Matter opened.',
            };

      await tx.insert(matterUpdates).values({
        matterId: created.id,
        authorId: userId,
        updateType: createdTimeline.updateType,
        message: createdTimeline.message,
      });

      // Notify assigned owner & participants (only active members of this space)
      const notifyTargets = new Set<string>();
      if (ownerId !== userId && memberSet.has(ownerId)) notifyTargets.add(ownerId);
      for (const pid of participantIds) {
        if (pid !== userId && memberSet.has(pid)) notifyTargets.add(pid);
      }
      if (notifyTargets.size > 0) {
        await tx.insert(notifications).values(
          [...notifyTargets].map((uid) => ({
            userId: uid,
            matterId: created.id,
            message:
              uid === ownerId
                ? `You were assigned responsibility for "${created.title}".`
                : `You were added as a participant on "${created.title}".`,
          }))
        );
      }

      const [hydrated] = await hydrateMatters([created], tx);
      return hydrated;
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (['NOT_FOUND', 'FORBIDDEN', 'FORBIDDEN_ROLE'].includes(error.message) ||
        error.message.startsWith('VALIDATION:'))
    ) {
      throw error;
    }
    console.error('Database query failed in createMatter:', error);
    throw new Error('Failed to create matter.', { cause: error });
  }
}

export async function getMatterById(
  userId: string,
  matterId: string,
  txClient: DbClient = db
) {
  if (!isValidUuid(matterId)) {
    throw new Error('NOT_FOUND');
  }

  try {
    const [matter] = await txClient
      .select()
      .from(matters)
      .where(eq(matters.id, matterId))
      .limit(1);

    if (!matter) throw new Error('NOT_FOUND');

    const membership = await getMembership(userId, matter.spaceId, txClient);
    if (!membership) throw new Error('FORBIDDEN');

    const [hydrated] = await hydrateMatters([matter], txClient);

    const updates = await txClient
      .select({
        id: matterUpdates.id,
        matterId: matterUpdates.matterId,
        authorId: matterUpdates.authorId,
        updateType: matterUpdates.updateType,
        message: matterUpdates.message,
        createdAt: matterUpdates.createdAt,
        authorName: users.displayName,
        authorEmail: users.email,
      })
      .from(matterUpdates)
      .leftJoin(users, eq(matterUpdates.authorId, users.id))
      .where(eq(matterUpdates.matterId, matterId))
      .orderBy(matterUpdates.createdAt);

    const spaceMembers = await txClient
      .select({
        userId: users.id,
        displayName: users.displayName,
        email: users.email,
        role: spaceMemberships.role,
      })
      .from(spaceMemberships)
      .innerJoin(users, eq(spaceMemberships.userId, users.id))
      .where(eq(spaceMemberships.spaceId, matter.spaceId))
      .orderBy(users.displayName);

    return {
      ...hydrated,
      currentUserRole: membership.role,
      permissions: computeMatterPermissions(userId, membership.role, matter),
      updates,
      spaceMembers,
    };
  } catch (error) {
    if (
      error instanceof Error &&
      ['NOT_FOUND', 'FORBIDDEN'].includes(error.message)
    ) {
      throw error;
    }
    console.error('Database query failed in getMatterById:', error);
    throw new Error('Failed to load matter details.', { cause: error });
  }
}

export async function updateMatter(
  userId: string,
  matterId: string,
  input: {
    title?: string;
    description?: string;
    category?: string;
    status?: string;
    priority?: string;
    ownerId?: string | null;
    waitingFor?: string | null;
    nextAction?: string | null;
    nextActionAt?: string | null;
    dueAt?: string | null;
    resolution?: string | null;
    participantIds?: string[];
  }
) {
  if (!isValidUuid(matterId)) {
    throw new Error('NOT_FOUND');
  }

  try {
    return await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(matters)
        .where(eq(matters.id, matterId))
        .limit(1);

      if (!existing) throw new Error('NOT_FOUND');

      const membership = await getMembership(userId, existing.spaceId, tx);
      if (!membership) throw new Error('FORBIDDEN');

      const perms = computeMatterPermissions(userId, membership.role, existing);
      if (!perms.canEditDetails) {
        throw new Error('FORBIDDEN_ROLE');
      }

      const spaceMembers = await tx
        .select({ userId: spaceMemberships.userId, displayName: users.displayName })
        .from(spaceMemberships)
        .innerJoin(users, eq(spaceMemberships.userId, users.id))
        .where(eq(spaceMemberships.spaceId, existing.spaceId));
      const memberMap = new Map(spaceMembers.map((m) => [m.userId, m.displayName]));

      const existingParticipants = await tx
        .select({ userId: matterParticipants.userId })
        .from(matterParticipants)
        .where(eq(matterParticipants.matterId, matterId));
      const existingParticipantSet = new Set(existingParticipants.map((p) => p.userId));

      const nextTitle =
        input.title !== undefined ? input.title.trim() : existing.title;
      if (!nextTitle || nextTitle.length < 2 || nextTitle.length > 160) {
        throw new Error('VALIDATION: Title must be between 2 and 160 characters.');
      }

      const nextDescription =
        input.description !== undefined
          ? input.description.trim()
          : existing.description;

      const nextCategory =
        input.category !== undefined
          ? input.category.trim() || 'General'
          : existing.category;

      const nextStatus = (input.status ?? existing.status) as MatterStatus;
      if (!MATTER_STATUSES.includes(nextStatus)) {
        throw new Error('VALIDATION: Invalid matter status.');
      }

      const nextPriority = (input.priority ?? existing.priority) as MatterPriority;
      if (!MATTER_PRIORITIES.includes(nextPriority)) {
        throw new Error('VALIDATION: Invalid matter priority.');
      }

      if (
        input.ownerId !== undefined &&
        input.ownerId !== null &&
        (typeof input.ownerId !== 'string' || input.ownerId.trim() === '')
      ) {
        throw new Error('VALIDATION: Assigned owner cannot be empty.');
      }

      const nextOwnerId =
        input.ownerId !== undefined ? input.ownerId : existing.ownerId;
      const ownerChanged = nextOwnerId !== existing.ownerId;
      if (ownerChanged && !perms.canChangeOwnership) {
        throw new Error('FORBIDDEN_ROLE');
      }
      if (
        nextOwnerId !== null &&
        (!isValidUuid(nextOwnerId) || !memberMap.has(nextOwnerId))
      ) {
        throw new Error('VALIDATION: Assigned owner must be a member of this space.');
      }

      const statusChanged = nextStatus !== existing.status;
      if (
        (existing.status === 'Archived' || nextStatus === 'Archived') &&
        !perms.canArchiveRestore
      ) {
        throw new Error('FORBIDDEN_ROLE');
      }

      let validParticipants: string[] | null = null;
      let addedParticipantIds: string[] = [];
      let removedParticipantIds: string[] = [];

      if (input.participantIds !== undefined) {
        validParticipants = [...new Set(input.participantIds)].filter(
          (id) => isValidUuid(id) && memberMap.has(id)
        );
        addedParticipantIds = validParticipants.filter(
          (id) => !existingParticipantSet.has(id)
        );
        removedParticipantIds = [...existingParticipantSet].filter(
          (id) => !validParticipants!.includes(id)
        );

        if (
          (addedParticipantIds.length > 0 || removedParticipantIds.length > 0) &&
          !perms.canManageParticipants
        ) {
          throw new Error('FORBIDDEN_ROLE');
        }
      }

      // Lifecycle: clear stale waitingFor when leaving 'Waiting'
      const nextWaitingFor =
        nextStatus !== 'Waiting'
          ? null
          : input.waitingFor !== undefined
          ? input.waitingFor?.trim() || null
          : existing.waitingFor;

      if (nextStatus === 'Waiting' && !nextWaitingFor) {
        throw new Error(
          'VALIDATION: Please specify who or what this matter is waiting for.'
        );
      }

      const nextAction =
        input.nextAction !== undefined
          ? input.nextAction?.trim() || null
          : existing.nextAction;

      const nextActionAt =
        input.nextActionAt !== undefined
          ? parseOptionalDate(input.nextActionAt)
          : existing.nextActionAt;

      const nextDueAt =
        input.dueAt !== undefined
          ? parseOptionalDate(input.dueAt)
          : existing.dueAt;

      // Lifecycle: clear stale resolution when reopening to active work; require latest resolution on completion
      let nextResolution: string | null;
      if (nextStatus === 'Completed') {
        if (input.resolution !== undefined) {
          nextResolution = input.resolution?.trim() || null;
        } else if (existing.status === 'Completed' || existing.status === 'Archived') {
          nextResolution = existing.resolution;
        } else {
          nextResolution = null;
        }
        if (!nextResolution) {
          throw new Error(
            'VALIDATION: Please record a resolution before marking this matter completed.'
          );
        }
      } else if (nextStatus === 'Archived') {
        nextResolution =
          input.resolution !== undefined
            ? input.resolution?.trim() || null
            : existing.resolution;
      } else {
        nextResolution = null;
      }

      const completedAt =
        nextStatus === 'Completed'
          ? existing.status !== 'Completed'
            ? new Date()
            : existing.completedAt || new Date()
          : nextStatus === 'Archived'
          ? existing.completedAt
          : null;

      const [updated] = await tx
        .update(matters)
        .set({
          title: nextTitle,
          description: nextDescription,
          category: nextCategory,
          status: nextStatus,
          priority: nextPriority,
          ownerId: nextOwnerId,
          waitingFor: nextWaitingFor,
          nextAction,
          nextActionAt,
          dueAt: nextDueAt,
          resolution: nextResolution,
          completedAt,
          updatedAt: new Date(),
        })
        .where(eq(matters.id, matterId))
        .returning();

      if (validParticipants !== null && (addedParticipantIds.length > 0 || removedParticipantIds.length > 0)) {
        await tx
          .delete(matterParticipants)
          .where(eq(matterParticipants.matterId, matterId));
        if (validParticipants.length > 0) {
          await tx.insert(matterParticipants).values(
            validParticipants.map((pid) => ({
              matterId,
              userId: pid,
            }))
          );
        }
      }

      // Record complete, non-duplicate timeline entries for all meaningful changes
      const timelineEvents: { updateType: string; message: string }[] = [];

      if (statusChanged) {
        if (nextStatus === 'Completed') {
          timelineEvents.push({
            updateType: 'completed',
            message: `Marked completed. Resolution: ${nextResolution}`,
          });
        } else if (nextStatus === 'Archived') {
          timelineEvents.push({
            updateType: 'archived',
            message: 'Matter archived.',
          });
        } else if (existing.status === 'Archived') {
          timelineEvents.push({
            updateType: 'status_change',
            message: `Matter restored from archive to ${nextStatus}.`,
          });
        } else if (nextStatus === 'Waiting') {
          timelineEvents.push({
            updateType: 'status_change',
            message: `Status changed from ${existing.status} to Waiting (Waiting for: ${nextWaitingFor}).`,
          });
        } else if (existing.status === 'Waiting') {
          timelineEvents.push({
            updateType: 'status_change',
            message: `Status changed from Waiting to ${nextStatus} (cleared waiting blocker).`,
          });
        } else {
          timelineEvents.push({
            updateType: 'status_change',
            message: `Status changed from ${existing.status} to ${nextStatus}.`,
          });
        }
      }

      if (existing.priority !== nextPriority) {
        timelineEvents.push({
          updateType: 'priority_change',
          message: `Priority changed from ${existing.priority} to ${nextPriority}.`,
        });
      }

      if (existing.title !== updated.title) {
        timelineEvents.push({
          updateType: 'edited',
          message: `Title updated from "${existing.title}" to "${updated.title}".`,
        });
      }

      if (existing.description !== updated.description) {
        timelineEvents.push({
          updateType: 'edited',
          message: updated.description
            ? 'Description updated.'
            : 'Description cleared.',
        });
      }

      if (existing.category !== updated.category) {
        timelineEvents.push({
          updateType: 'edited',
          message: `Category changed from ${existing.category} to ${updated.category}.`,
        });
      }

      if (ownerChanged) {
        const newOwnerName = nextOwnerId
          ? memberMap.get(nextOwnerId) || 'Member'
          : 'Unassigned';
        timelineEvents.push({
          updateType: 'assignment',
          message: nextOwnerId
            ? `Ownership assigned to ${newOwnerName}.`
            : 'Ownership unassigned.',
        });
      }

      if (addedParticipantIds.length > 0) {
        const names = addedParticipantIds.map((pid) => memberMap.get(pid) || 'Member');
        timelineEvents.push({
          updateType: 'participants',
          message: `Added participant(s): ${names.join(', ')}.`,
        });
      }

      if (removedParticipantIds.length > 0) {
        const names = removedParticipantIds.map((pid) => memberMap.get(pid) || 'Member');
        timelineEvents.push({
          updateType: 'participants',
          message: `Removed participant(s): ${names.join(', ')}.`,
        });
      }

      // Avoid duplicating waitingFor/resolution entries when status transition already recorded them
      if (
        !statusChanged &&
        nextStatus === 'Waiting' &&
        existing.waitingFor !== nextWaitingFor &&
        nextWaitingFor
      ) {
        timelineEvents.push({
          updateType: 'waiting_updated',
          message: `Waiting for updated: "${nextWaitingFor}".`,
        });
      }

      if (
        !statusChanged &&
        nextStatus === 'Completed' &&
        existing.resolution !== nextResolution &&
        nextResolution
      ) {
        timelineEvents.push({
          updateType: 'resolution_updated',
          message: `Resolution updated: ${nextResolution}`,
        });
      }

      if (existing.nextAction !== nextAction) {
        timelineEvents.push({
          updateType: 'next_action',
          message: nextAction
            ? `Next action updated: "${nextAction}"`
            : 'Next action cleared.',
        });
      }

      if (!sameOptionalDate(existing.nextActionAt, nextActionAt)) {
        timelineEvents.push({
          updateType: 'schedule_change',
          message: nextActionAt
            ? `Follow-up date set to ${formatTimelineDate(nextActionAt)}.`
            : 'Follow-up date cleared.',
        });
      }

      if (!sameOptionalDate(existing.dueAt, nextDueAt)) {
        timelineEvents.push({
          updateType: 'schedule_change',
          message: nextDueAt
            ? `Target due date set to ${formatTimelineDate(nextDueAt)}.`
            : 'Target due date cleared.',
        });
      }

      if (timelineEvents.length > 0) {
        await tx.insert(matterUpdates).values(
          timelineEvents.map((ev) => ({
            matterId,
            authorId: userId,
            updateType: ev.updateType,
            message: ev.message,
          }))
        );
      }

      // Notify newly assigned owner and newly added participants (active space members only)
      const notificationRecords: { userId: string; matterId: string; message: string }[] = [];
      const notifiedUsers = new Set<string>();

      if (ownerChanged && nextOwnerId && nextOwnerId !== userId && memberMap.has(nextOwnerId)) {
        notificationRecords.push({
          userId: nextOwnerId,
          matterId,
          message: `You were assigned responsibility for "${updated.title}".`,
        });
        notifiedUsers.add(nextOwnerId);
      }

      for (const pid of addedParticipantIds) {
        if (pid !== userId && memberMap.has(pid) && !notifiedUsers.has(pid)) {
          notificationRecords.push({
            userId: pid,
            matterId,
            message: `You were added as a participant on "${updated.title}".`,
          });
          notifiedUsers.add(pid);
        }
      }

      if (notificationRecords.length > 0) {
        await tx.insert(notifications).values(notificationRecords);
      }

      return await getMatterById(userId, matterId, tx);
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (['NOT_FOUND', 'FORBIDDEN', 'FORBIDDEN_ROLE'].includes(error.message) ||
        error.message.startsWith('VALIDATION:'))
    ) {
      throw error;
    }
    console.error('Database query failed in updateMatter:', error);
    throw new Error('Failed to update matter.', { cause: error });
  }
}

export async function deleteMatter(userId: string, matterId: string) {
  if (!isValidUuid(matterId)) {
    throw new Error('NOT_FOUND');
  }

  try {
    const [existing] = await db
      .select()
      .from(matters)
      .where(eq(matters.id, matterId))
      .limit(1);
    if (!existing) throw new Error('NOT_FOUND');

    const membership = await getMembership(userId, existing.spaceId);
    if (!membership) throw new Error('FORBIDDEN');

    const perms = computeMatterPermissions(userId, membership.role, existing);
    if (!perms.canDelete) {
      throw new Error('FORBIDDEN_ROLE');
    }

    await db.delete(matters).where(eq(matters.id, matterId));
    return { deleted: true };
  } catch (error) {
    if (
      error instanceof Error &&
      ['NOT_FOUND', 'FORBIDDEN', 'FORBIDDEN_ROLE'].includes(error.message)
    ) {
      throw error;
    }
    console.error('Database query failed in deleteMatter:', error);
    throw new Error('Failed to delete matter.', { cause: error });
  }
}

export async function addMatterUpdate(
  userId: string,
  matterId: string,
  input: {
    message: string;
    updateType?: string;
  }
) {
  if (!isValidUuid(matterId)) {
    throw new Error('NOT_FOUND');
  }
  const message = input.message?.trim();
  if (!message || message.length < 1 || message.length > 2000) {
    throw new Error('VALIDATION: Update message is required.');
  }

  let updateType: (typeof USER_ALLOWED_UPDATE_TYPES)[number] = 'note';
  if (input.updateType !== undefined && input.updateType !== null) {
    if (typeof input.updateType !== 'string') {
      throw new Error('VALIDATION: Invalid update type.');
    }
    const normalizedType = input.updateType.trim();
    if (!USER_ALLOWED_UPDATE_TYPES.includes(normalizedType as 'note')) {
      throw new Error(
        'VALIDATION: Invalid update type. Only progress notes ("note") can be posted.'
      );
    }
    updateType = normalizedType as (typeof USER_ALLOWED_UPDATE_TYPES)[number];
  }

  try {
    return await db.transaction(async (tx) => {
      const [matter] = await tx
        .select()
        .from(matters)
        .where(eq(matters.id, matterId))
        .limit(1);
      if (!matter) throw new Error('NOT_FOUND');

      const membership = await getMembership(userId, matter.spaceId, tx);
      if (!membership) throw new Error('FORBIDDEN');

      if (matter.status === 'Archived') {
        throw new Error(
          'VALIDATION: Archived matters cannot receive progress updates. Restore the matter first.'
        );
      }

      const [createdUpdate] = await tx
        .insert(matterUpdates)
        .values({
          matterId,
          authorId: userId,
          updateType,
          message,
        })
        .returning();

      await tx
        .update(matters)
        .set({ updatedAt: new Date() })
        .where(eq(matters.id, matterId));

      // Notify owner & participants except author, verified against active space memberships
      const participants = await tx
        .select({ userId: matterParticipants.userId })
        .from(matterParticipants)
        .where(eq(matterParticipants.matterId, matterId));

      const activeMembers = await tx
        .select({ userId: spaceMemberships.userId })
        .from(spaceMemberships)
        .where(eq(spaceMemberships.spaceId, matter.spaceId));

      const activeMemberSet = new Set(activeMembers.map((m) => m.userId));
      const targets = new Set<string>();
      if (matter.ownerId && matter.ownerId !== userId && activeMemberSet.has(matter.ownerId)) {
        targets.add(matter.ownerId);
      }
      for (const p of participants) {
        if (p.userId !== userId && activeMemberSet.has(p.userId)) {
          targets.add(p.userId);
        }
      }

      if (targets.size > 0) {
        await tx.insert(notifications).values(
          [...targets].map((uid) => ({
            userId: uid,
            matterId,
            message: `New update on "${matter.title}": ${message.slice(0, 120)}${
              message.length > 120 ? '...' : ''
            }`,
          }))
        );
      }

      const [author] = await tx
        .select({ displayName: users.displayName, email: users.email })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      return {
        ...createdUpdate,
        authorName: author?.displayName || 'Unknown',
        authorEmail: author?.email || '',
      };
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (['NOT_FOUND', 'FORBIDDEN'].includes(error.message) ||
        error.message.startsWith('VALIDATION:'))
    ) {
      throw error;
    }
    console.error('Database query failed in addMatterUpdate:', error);
    throw new Error('Failed to post update.', { cause: error });
  }
}

export async function getGlobalTimeline(
  userId: string,
  filters: { spaceId?: string; limit?: number }
) {
  try {
    const memberships = await db
      .select({ spaceId: spaceMemberships.spaceId })
      .from(spaceMemberships)
      .where(eq(spaceMemberships.userId, userId));

    const accessibleSpaceIds = memberships.map((m) => m.spaceId);
    if (accessibleSpaceIds.length === 0) return [];

    let targetSpaceIds = accessibleSpaceIds;
    if (filters.spaceId && filters.spaceId !== 'All') {
      if (!isValidUuid(filters.spaceId) || !accessibleSpaceIds.includes(filters.spaceId)) {
        throw new Error('FORBIDDEN');
      }
      targetSpaceIds = [filters.spaceId];
    }

    const rows = await db
      .select({
        id: matterUpdates.id,
        matterId: matterUpdates.matterId,
        authorId: matterUpdates.authorId,
        updateType: matterUpdates.updateType,
        message: matterUpdates.message,
        createdAt: matterUpdates.createdAt,
        matterTitle: matters.title,
        matterStatus: matters.status,
        spaceId: spaces.id,
        spaceName: spaces.name,
        spaceType: spaces.type,
        authorName: users.displayName,
      })
      .from(matterUpdates)
      .innerJoin(matters, eq(matterUpdates.matterId, matters.id))
      .innerJoin(spaces, eq(matters.spaceId, spaces.id))
      .leftJoin(users, eq(matterUpdates.authorId, users.id))
      .where(inArray(matters.spaceId, targetSpaceIds))
      .orderBy(desc(matterUpdates.createdAt))
      .limit(filters.limit || 60);

    return rows;
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN') throw error;
    console.error('Database query failed in getGlobalTimeline:', error);
    throw new Error('Failed to load timeline.', { cause: error });
  }
}
