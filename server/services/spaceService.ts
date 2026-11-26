import { and, desc, eq, inArray, ne } from 'drizzle-orm';
import { db } from '../../src/db/index.ts';
import {
  matters,
  notifications,
  spaceMemberships,
  spaces,
  users,
} from '../../src/db/schema.ts';

export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

export type SpaceType = 'personal' | 'family' | 'community';
export type SpaceRole = 'owner' | 'admin' | 'member';

export const VALID_SPACE_TYPES: SpaceType[] = ['personal', 'family', 'community'];
export const VALID_ROLES: SpaceRole[] = ['owner', 'admin', 'member'];

export async function getMembership(userId: string, spaceId: string) {
  if (!isValidUuid(spaceId)) return null;
  try {
    const [membership] = await db
      .select()
      .from(spaceMemberships)
      .where(
        and(eq(spaceMemberships.userId, userId), eq(spaceMemberships.spaceId, spaceId))
      )
      .limit(1);
    return membership || null;
  } catch (error) {
    console.error('Database query failed in getMembership:', error);
    throw new Error('Failed to verify space membership.', { cause: error });
  }
}

export async function listUserSpaces(userId: string) {
  try {
    const rows = await db
      .select({
        id: spaces.id,
        name: spaces.name,
        type: spaces.type,
        description: spaces.description,
        createdBy: spaces.createdBy,
        createdAt: spaces.createdAt,
        role: spaceMemberships.role,
        joinedAt: spaceMemberships.joinedAt,
      })
      .from(spaceMemberships)
      .innerJoin(spaces, eq(spaceMemberships.spaceId, spaces.id))
      .where(eq(spaceMemberships.userId, userId))
      .orderBy(spaces.type, desc(spaces.createdAt));

    if (rows.length === 0) return [];

    const spaceIds = rows.map((r) => r.id);

    const allMembers = await db
      .select({
        spaceId: spaceMemberships.spaceId,
        userId: users.id,
        displayName: users.displayName,
        email: users.email,
        role: spaceMemberships.role,
      })
      .from(spaceMemberships)
      .innerJoin(users, eq(spaceMemberships.userId, users.id))
      .where(inArray(spaceMemberships.spaceId, spaceIds));

    const allMatters = await db
      .select({
        spaceId: matters.spaceId,
        status: matters.status,
      })
      .from(matters)
      .where(inArray(matters.spaceId, spaceIds));

    return rows.map((space) => {
      const members = allMembers.filter((m) => m.spaceId === space.id);
      const spaceMatters = allMatters.filter((m) => m.spaceId === space.id);
      const activeMatterCount = spaceMatters.filter(
        (m) => m.status !== 'Completed' && m.status !== 'Archived'
      ).length;

      return {
        ...space,
        memberCount: members.length,
        activeMatterCount,
        totalMatterCount: spaceMatters.length,
        members,
      };
    });
  } catch (error) {
    console.error('Database query failed in listUserSpaces:', error);
    throw new Error('Failed to load spaces.', { cause: error });
  }
}

export async function createSpace(
  userId: string,
  input: { name: string; type: string; description?: string }
) {
  const name = input.name?.trim();
  const type = input.type?.trim().toLowerCase() as SpaceType;
  const description = input.description?.trim() || '';

  if (!name || name.length < 2 || name.length > 80) {
    throw new Error('VALIDATION: Space name must be between 2 and 80 characters.');
  }
  if (type !== 'family' && type !== 'community') {
    throw new Error('VALIDATION: Space type must be family or community.');
  }

  try {
    const [space] = await db
      .insert(spaces)
      .values({
        name,
        type,
        description,
        createdBy: userId,
      })
      .returning();

    await db.insert(spaceMemberships).values({
      spaceId: space.id,
      userId,
      role: 'owner',
    });

    return space;
  } catch (error) {
    console.error('Database query failed in createSpace:', error);
    throw new Error('Failed to create space.', { cause: error });
  }
}

export async function getSpaceById(userId: string, spaceId: string) {
  if (!isValidUuid(spaceId)) {
    throw new Error('NOT_FOUND');
  }

  try {
    const membership = await getMembership(userId, spaceId);
    if (!membership) {
      throw new Error('FORBIDDEN');
    }

    const [space] = await db.select().from(spaces).where(eq(spaces.id, spaceId)).limit(1);
    if (!space) {
      throw new Error('NOT_FOUND');
    }

    const members = await db
      .select({
        membershipId: spaceMemberships.id,
        userId: users.id,
        displayName: users.displayName,
        email: users.email,
        role: spaceMemberships.role,
        joinedAt: spaceMemberships.joinedAt,
      })
      .from(spaceMemberships)
      .innerJoin(users, eq(spaceMemberships.userId, users.id))
      .where(eq(spaceMemberships.spaceId, spaceId))
      .orderBy(spaceMemberships.joinedAt);

    return {
      ...space,
      currentUserRole: membership.role,
      members,
    };
  } catch (error) {
    if (error instanceof Error && (error.message === 'NOT_FOUND' || error.message === 'FORBIDDEN')) {
      throw error;
    }
    console.error('Database query failed in getSpaceById:', error);
    throw new Error('Failed to load space details.', { cause: error });
  }
}

export async function addSpaceMember(
  actorId: string,
  spaceId: string,
  input: { email: string; role?: string }
) {
  if (!isValidUuid(spaceId)) {
    throw new Error('NOT_FOUND');
  }

  const email = input.email?.trim().toLowerCase();
  const role = (input.role?.trim().toLowerCase() || 'member') as SpaceRole;

  if (!email) {
    throw new Error('VALIDATION: Member email is required.');
  }
  if (!VALID_ROLES.includes(role) || role === 'owner') {
    throw new Error('VALIDATION: Invited member role must be admin or member.');
  }

  try {
    const actorMembership = await getMembership(actorId, spaceId);
    if (!actorMembership) {
      throw new Error('FORBIDDEN');
    }
    if (actorMembership.role !== 'owner' && actorMembership.role !== 'admin') {
      throw new Error('FORBIDDEN_ROLE');
    }

    const [space] = await db.select().from(spaces).where(eq(spaces.id, spaceId)).limit(1);
    if (!space) {
      throw new Error('NOT_FOUND');
    }
    if (space.type === 'personal') {
      throw new Error('PERSONAL_SPACE_PRIVATE');
    }

    const [targetUser] = await db
      .select({
        id: users.id,
        displayName: users.displayName,
        email: users.email,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!targetUser) {
      throw new Error('USER_NOT_FOUND');
    }

    const existingMember = await getMembership(targetUser.id, spaceId);
    if (existingMember) {
      throw new Error('ALREADY_MEMBER');
    }

    const [membership] = await db
      .insert(spaceMemberships)
      .values({
        spaceId,
        userId: targetUser.id,
        role,
      })
      .returning();

    await db.insert(notifications).values({
      userId: targetUser.id,
      message: `You were added to ${space.name} (${space.type} space) as ${role}.`,
    });

    return {
      membershipId: membership.id,
      userId: targetUser.id,
      displayName: targetUser.displayName,
      email: targetUser.email,
      role: membership.role,
      joinedAt: membership.joinedAt,
    };
  } catch (error) {
    if (
      error instanceof Error &&
      [
        'NOT_FOUND',
        'FORBIDDEN',
        'FORBIDDEN_ROLE',
        'PERSONAL_SPACE_PRIVATE',
        'USER_NOT_FOUND',
        'ALREADY_MEMBER',
      ].includes(error.message)
    ) {
      throw error;
    }
    if (error instanceof Error && error.message.startsWith('VALIDATION:')) {
      throw error;
    }
    console.error('Database query failed in addSpaceMember:', error);
    throw new Error('Failed to add member to space.', { cause: error });
  }
}

export async function updateSpaceMemberRole(
  actorId: string,
  spaceId: string,
  targetUserId: string,
  newRole: string
) {
  if (!isValidUuid(spaceId) || !isValidUuid(targetUserId)) {
    throw new Error('NOT_FOUND');
  }
  const role = newRole.trim().toLowerCase() as SpaceRole;
  if (!VALID_ROLES.includes(role)) {
    throw new Error('VALIDATION: Invalid role.');
  }

  try {
    const actorMembership = await getMembership(actorId, spaceId);
    if (!actorMembership) throw new Error('FORBIDDEN');
    if (actorMembership.role !== 'owner') {
      throw new Error('FORBIDDEN_ROLE');
    }

    const targetMembership = await getMembership(targetUserId, spaceId);
    if (!targetMembership) throw new Error('NOT_FOUND');

    if (targetMembership.role === 'owner' && role !== 'owner') {
      const otherOwners = await db
        .select({ id: spaceMemberships.id })
        .from(spaceMemberships)
        .where(
          and(
            eq(spaceMemberships.spaceId, spaceId),
            eq(spaceMemberships.role, 'owner'),
            ne(spaceMemberships.userId, targetUserId)
          )
        );
      if (otherOwners.length === 0) {
        throw new Error('VALIDATION: A space must have at least one owner.');
      }
    }

    const [updated] = await db
      .update(spaceMemberships)
      .set({ role })
      .where(
        and(
          eq(spaceMemberships.spaceId, spaceId),
          eq(spaceMemberships.userId, targetUserId)
        )
      )
      .returning();

    return updated;
  } catch (error) {
    if (
      error instanceof Error &&
      (['NOT_FOUND', 'FORBIDDEN', 'FORBIDDEN_ROLE'].includes(error.message) ||
        error.message.startsWith('VALIDATION:'))
    ) {
      throw error;
    }
    console.error('Database query failed in updateSpaceMemberRole:', error);
    throw new Error('Failed to update member role.', { cause: error });
  }
}

export async function removeSpaceMember(
  actorId: string,
  spaceId: string,
  targetUserId: string
) {
  if (!isValidUuid(spaceId) || !isValidUuid(targetUserId)) {
    throw new Error('NOT_FOUND');
  }

  try {
    const [space] = await db.select().from(spaces).where(eq(spaces.id, spaceId)).limit(1);
    if (!space) throw new Error('NOT_FOUND');
    if (space.type === 'personal') {
      throw new Error('PERSONAL_SPACE_PRIVATE');
    }

    const actorMembership = await getMembership(actorId, spaceId);
    if (!actorMembership) throw new Error('FORBIDDEN');

    const isSelf = actorId === targetUserId;
    if (!isSelf && actorMembership.role !== 'owner' && actorMembership.role !== 'admin') {
      throw new Error('FORBIDDEN_ROLE');
    }

    const targetMembership = await getMembership(targetUserId, spaceId);
    if (!targetMembership) throw new Error('NOT_FOUND');

    if (targetMembership.role === 'owner') {
      const otherOwners = await db
        .select({ id: spaceMemberships.id })
        .from(spaceMemberships)
        .where(
          and(
            eq(spaceMemberships.spaceId, spaceId),
            eq(spaceMemberships.role, 'owner'),
            ne(spaceMemberships.userId, targetUserId)
          )
        );
      if (otherOwners.length === 0) {
        throw new Error('VALIDATION: Cannot remove the sole owner of a space.');
      }
    }

    await db
      .delete(spaceMemberships)
      .where(
        and(
          eq(spaceMemberships.spaceId, spaceId),
          eq(spaceMemberships.userId, targetUserId)
        )
      );

    return { removed: true };
  } catch (error) {
    if (
      error instanceof Error &&
      (['NOT_FOUND', 'FORBIDDEN', 'FORBIDDEN_ROLE', 'PERSONAL_SPACE_PRIVATE'].includes(
        error.message
      ) ||
        error.message.startsWith('VALIDATION:'))
    ) {
      throw error;
    }
    console.error('Database query failed in removeSpaceMember:', error);
    throw new Error('Failed to remove member from space.', { cause: error });
  }
}
