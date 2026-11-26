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

async function hydrateMatters(matterRows: (typeof matters.$inferSelect)[]) {
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

  const [spaceRows, participantRows, updateRows] = await Promise.all([
    db
      .select({ id: spaces.id, name: spaces.name, type: spaces.type })
      .from(spaces)
      .where(inArray(spaces.id, spaceIds)),
    db
      .select({
        matterId: matterParticipants.matterId,
        userId: users.id,
        displayName: users.displayName,
        email: users.email,
      })
      .from(matterParticipants)
      .innerJoin(users, eq(matterParticipants.userId, users.id))
      .where(inArray(matterParticipants.matterId, matterIds)),
    db
      .select({
        matterId: matterUpdates.matterId,
      })
      .from(matterUpdates)
      .where(inArray(matterUpdates.matterId, matterIds)),
  ]);

  const allUserIds = [
    ...new Set([...userIds, ...participantRows.map((p) => p.userId)]),
  ];

  const userRows =
    allUserIds.length > 0
      ? await db
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

  const waitingFor = input.waitingFor?.trim() || null;
  if (status === 'Waiting' && !waitingFor) {
    throw new Error(
      'VALIDATION: Please specify who or what this matter is waiting for.'
    );
  }

  const nextAction = input.nextAction?.trim() || null;
  const nextActionAt = parseOptionalDate(input.nextActionAt);
  const dueAt = parseOptionalDate(input.dueAt);

  try {
    const membership = await getMembership(userId, spaceId);
    if (!membership) throw new Error('FORBIDDEN');

    const spaceMembers = await db
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

    const [created] = await db
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
        completedAt: status === 'Completed' ? new Date() : null,
      })
      .returning();

    if (participantIds.length > 0) {
      await db
        .insert(matterParticipants)
        .values(
          participantIds.map((pid) => ({
            matterId: created.id,
            userId: pid,
          }))
        )
        .onConflictDoNothing();
    }

    await db.insert(matterUpdates).values({
      matterId: created.id,
      authorId: userId,
      updateType: 'created',
      message: nextAction
        ? `Matter opened with next action: "${nextAction}"`
        : 'Matter opened.',
    });

    // Notify assigned owner & participants
    const notifyTargets = new Set<string>();
    if (ownerId !== userId) notifyTargets.add(ownerId);
    for (const pid of participantIds) {
      if (pid !== userId) notifyTargets.add(pid);
    }
    if (notifyTargets.size > 0) {
      await db.insert(notifications).values(
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

    const [hydrated] = await hydrateMatters([created]);
    return hydrated;
  } catch (error) {
    if (
      error instanceof Error &&
      (['NOT_FOUND', 'FORBIDDEN'].includes(error.message) ||
        error.message.startsWith('VALIDATION:'))
    ) {
      throw error;
    }
    console.error('Database query failed in createMatter:', error);
    throw new Error('Failed to create matter.', { cause: error });
  }
}

export async function getMatterById(userId: string, matterId: string) {
  if (!isValidUuid(matterId)) {
    throw new Error('NOT_FOUND');
  }

  try {
    const [matter] = await db
      .select()
      .from(matters)
      .where(eq(matters.id, matterId))
      .limit(1);

    if (!matter) throw new Error('NOT_FOUND');

    const membership = await getMembership(userId, matter.spaceId);
    if (!membership) throw new Error('FORBIDDEN');

    const [hydrated] = await hydrateMatters([matter]);

    const updates = await db
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

    const spaceMembers = await db
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
    const [existing] = await db
      .select()
      .from(matters)
      .where(eq(matters.id, matterId))
      .limit(1);

    if (!existing) throw new Error('NOT_FOUND');

    const membership = await getMembership(userId, existing.spaceId);
    if (!membership) throw new Error('FORBIDDEN');

    const spaceMembers = await db
      .select({ userId: spaceMemberships.userId, displayName: users.displayName })
      .from(spaceMemberships)
      .innerJoin(users, eq(spaceMemberships.userId, users.id))
      .where(eq(spaceMemberships.spaceId, existing.spaceId));
    const memberMap = new Map(spaceMembers.map((m) => [m.userId, m.displayName]));

    const nextTitle =
      input.title !== undefined ? input.title.trim() : existing.title;
    if (!nextTitle || nextTitle.length < 2 || nextTitle.length > 160) {
      throw new Error('VALIDATION: Title must be between 2 and 160 characters.');
    }

    const nextStatus = (input.status ?? existing.status) as MatterStatus;
    if (!MATTER_STATUSES.includes(nextStatus)) {
      throw new Error('VALIDATION: Invalid matter status.');
    }

    const nextPriority = (input.priority ?? existing.priority) as MatterPriority;
    if (!MATTER_PRIORITIES.includes(nextPriority)) {
      throw new Error('VALIDATION: Invalid matter priority.');
    }

    const nextWaitingFor =
      input.waitingFor !== undefined
        ? input.waitingFor?.trim() || null
        : existing.waitingFor;

    if (nextStatus === 'Waiting' && !nextWaitingFor) {
      throw new Error(
        'VALIDATION: Please specify who or what this matter is waiting for.'
      );
    }

    const nextOwnerId =
      input.ownerId !== undefined ? input.ownerId : existing.ownerId;
    if (nextOwnerId && (!isValidUuid(nextOwnerId) || !memberMap.has(nextOwnerId))) {
      throw new Error('VALIDATION: Assigned owner must be a member of this space.');
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

    const nextResolution =
      input.resolution !== undefined
        ? input.resolution?.trim() || null
        : existing.resolution;

    if (nextStatus === 'Completed' && !nextResolution) {
      throw new Error(
        'VALIDATION: Please record a resolution before marking this matter completed.'
      );
    }

    const completedAt =
      nextStatus === 'Completed'
        ? existing.completedAt || new Date()
        : nextStatus !== 'Archived'
        ? null
        : existing.completedAt;

    const [updated] = await db
      .update(matters)
      .set({
        title: nextTitle,
        description:
          input.description !== undefined
            ? input.description.trim()
            : existing.description,
        category:
          input.category !== undefined
            ? input.category.trim() || 'General'
            : existing.category,
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

    if (input.participantIds !== undefined) {
      const validParticipants = [...new Set(input.participantIds)].filter(
        (id) => isValidUuid(id) && memberMap.has(id)
      );
      await db
        .delete(matterParticipants)
        .where(eq(matterParticipants.matterId, matterId));
      if (validParticipants.length > 0) {
        await db.insert(matterParticipants).values(
          validParticipants.map((pid) => ({
            matterId,
            userId: pid,
          }))
        );
      }
    }

    // Record automatic timeline entries for key transitions
    const timelineEvents: { updateType: string; message: string }[] = [];

    if (existing.status !== nextStatus) {
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
      } else if (nextStatus === 'Waiting') {
        timelineEvents.push({
          updateType: 'status_change',
          message: `Status changed to Waiting (Waiting for: ${nextWaitingFor}).`,
        });
      } else {
        timelineEvents.push({
          updateType: 'status_change',
          message: `Status changed from ${existing.status} to ${nextStatus}.`,
        });
      }
    }

    if (existing.ownerId !== nextOwnerId) {
      const newOwnerName = nextOwnerId ? memberMap.get(nextOwnerId) || 'Member' : 'Unassigned';
      timelineEvents.push({
        updateType: 'assignment',
        message: `Ownership assigned to ${newOwnerName}.`,
      });
      if (nextOwnerId && nextOwnerId !== userId) {
        await db.insert(notifications).values({
          userId: nextOwnerId,
          matterId,
          message: `You were assigned responsibility for "${updated.title}".`,
        });
      }
    }

    if (existing.nextAction !== nextAction && nextAction) {
      timelineEvents.push({
        updateType: 'next_action',
        message: `Next action updated: "${nextAction}"`,
      });
    }

    if (
      timelineEvents.length === 0 &&
      (existing.title !== updated.title ||
        existing.description !== updated.description ||
        existing.priority !== updated.priority)
    ) {
      timelineEvents.push({
        updateType: 'edited',
        message: 'Matter details updated.',
      });
    }

    if (timelineEvents.length > 0) {
      await db.insert(matterUpdates).values(
        timelineEvents.map((ev) => ({
          matterId,
          authorId: userId,
          updateType: ev.updateType,
          message: ev.message,
        }))
      );
    }

    return await getMatterById(userId, matterId);
  } catch (error) {
    if (
      error instanceof Error &&
      (['NOT_FOUND', 'FORBIDDEN'].includes(error.message) ||
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

    const canDelete =
      existing.createdBy === userId ||
      existing.ownerId === userId ||
      membership.role === 'owner' ||
      membership.role === 'admin';

    if (!canDelete) {
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

  try {
    const [matter] = await db
      .select()
      .from(matters)
      .where(eq(matters.id, matterId))
      .limit(1);
    if (!matter) throw new Error('NOT_FOUND');

    const membership = await getMembership(userId, matter.spaceId);
    if (!membership) throw new Error('FORBIDDEN');

    const [createdUpdate] = await db
      .insert(matterUpdates)
      .values({
        matterId,
        authorId: userId,
        updateType: input.updateType || 'note',
        message,
      })
      .returning();

    await db
      .update(matters)
      .set({ updatedAt: new Date() })
      .where(eq(matters.id, matterId));

    // Notify owner & participants except author
    const participants = await db
      .select({ userId: matterParticipants.userId })
      .from(matterParticipants)
      .where(eq(matterParticipants.matterId, matterId));

    const targets = new Set<string>();
    if (matter.ownerId && matter.ownerId !== userId) {
      targets.add(matter.ownerId);
    }
    for (const p of participants) {
      if (p.userId !== userId) targets.add(p.userId);
    }

    if (targets.size > 0) {
      await db.insert(notifications).values(
        [...targets].map((uid) => ({
          userId: uid,
          matterId,
          message: `New update on "${matter.title}": ${message.slice(0, 120)}${
            message.length > 120 ? '...' : ''
          }`,
        }))
      );
    }

    const [author] = await db
      .select({ displayName: users.displayName, email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return {
      ...createdUpdate,
      authorName: author?.displayName || 'Unknown',
      authorEmail: author?.email || '',
    };
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
