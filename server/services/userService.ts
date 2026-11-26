import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../src/db/index.ts';
import { spaceMemberships, spaces, users } from '../../src/db/schema.ts';
import { hashPassword, verifyPassword } from '../lib/auth-crypto.ts';

export type DbClient =
  | typeof db
  | Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface PublicUser {
  id: string;
  uid: string | null;
  displayName: string;
  email: string;
  createdAt: Date;
}

export function sanitizeUser(row: typeof users.$inferSelect): PublicUser {
  return {
    id: row.id,
    uid: row.uid,
    displayName: row.displayName,
    email: row.email,
    createdAt: row.createdAt,
  };
}

function isPgUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current && typeof current === 'object'; depth += 1) {
    if ('code' in current && (current as { code?: string }).code === '23505') {
      return true;
    }
    current = 'cause' in current ? (current as { cause?: unknown }).cause : undefined;
  }
  return false;
}

export async function ensurePersonalSpace(
  userId: string,
  displayName: string,
  txClient?: DbClient
): Promise<string> {
  const run = async (tx: DbClient): Promise<string> => {
    const existing = await tx
      .select({ id: spaces.id })
      .from(spaces)
      .where(and(eq(spaces.createdBy, userId), eq(spaces.type, 'personal')))
      .limit(1);

    let personalSpaceId = existing[0]?.id;

    if (!personalSpaceId) {
      const firstName = displayName.trim().split(/\s+/)[0] || 'My';
      const [createdSpace] = await tx
        .insert(spaces)
        .values({
          name: `${firstName}'s Personal Space`,
          type: 'personal',
          description: 'Private personal responsibilities, follow-ups, and life matters.',
          createdBy: userId,
        })
        .onConflictDoNothing({
          target: spaces.createdBy,
          where: sql`${spaces.type} = 'personal'`,
        })
        .returning({ id: spaces.id });

      if (createdSpace) {
        personalSpaceId = createdSpace.id;
      } else {
        const [winner] = await tx
          .select({ id: spaces.id })
          .from(spaces)
          .where(and(eq(spaces.createdBy, userId), eq(spaces.type, 'personal')))
          .limit(1);
        personalSpaceId = winner?.id;
      }
    }

    if (!personalSpaceId) {
      throw new Error('Failed to resolve personal space after concurrent initialization.');
    }

    await tx
      .insert(spaceMemberships)
      .values({
        spaceId: personalSpaceId,
        userId,
        role: 'owner',
      })
      .onConflictDoNothing();

    return personalSpaceId;
  };

  try {
    if (txClient) {
      return await run(txClient);
    }
    return await db.transaction(run);
  } catch (error) {
    console.error('Failed to ensure personal space:', error);
    throw new Error('Failed to initialize personal space.', { cause: error });
  }
}

export async function getUserById(userId: string): Promise<PublicUser | null> {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    return user ? sanitizeUser(user) : null;
  } catch (error) {
    console.error('Database query failed in getUserById:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function upsertFirebaseUser(
  uid: string,
  email: string,
  displayName?: string
): Promise<PublicUser> {
  const normalizedEmail = email.trim().toLowerCase();
  const fallbackName = displayName?.trim() || normalizedEmail.split('@')[0] || 'User';

  try {
    return await db.transaction(async (tx) => {
      const existingByUid = await tx
        .select()
        .from(users)
        .where(eq(users.uid, uid))
        .limit(1);

      if (existingByUid.length > 0) {
        const current = existingByUid[0];
        if (current.email !== normalizedEmail) {
          const [updated] = await tx
            .update(users)
            .set({ email: normalizedEmail })
            .where(eq(users.id, current.id))
            .returning();
          await ensurePersonalSpace(updated.id, updated.displayName, tx);
          return sanitizeUser(updated);
        }
        await ensurePersonalSpace(current.id, current.displayName, tx);
        return sanitizeUser(current);
      }

      const existingByEmail = await tx
        .select()
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1);

      if (existingByEmail.length > 0) {
        const account = existingByEmail[0];
        if (account.uid && account.uid !== uid) {
          throw new Error('AUTH_UID_MISMATCH');
        }
        const [linked] = await tx
          .update(users)
          .set({ uid })
          .where(eq(users.id, account.id))
          .returning();
        await ensurePersonalSpace(linked.id, linked.displayName, tx);
        return sanitizeUser(linked);
      }

      const [inserted] = await tx
        .insert(users)
        .values({
          uid,
          email: normalizedEmail,
          displayName: fallbackName,
        })
        .onConflictDoUpdate({
          target: users.uid,
          set: { email: normalizedEmail },
        })
        .returning();

      await ensurePersonalSpace(inserted.id, inserted.displayName, tx);
      return sanitizeUser(inserted);
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'AUTH_UID_MISMATCH') {
      throw error;
    }
    console.error('Database query failed in upsertFirebaseUser:', error);
    throw new Error('Failed to synchronize user account.', { cause: error });
  }
}

export async function registerWithPassword(
  displayName: string,
  email: string,
  password: string
): Promise<PublicUser> {
  const normalizedEmail = email.trim().toLowerCase();
  const cleanName = displayName.trim();

  try {
    return await db.transaction(async (tx) => {
      const existing = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1);

      if (existing.length > 0) {
        throw new Error('EMAIL_EXISTS');
      }

      const passwordHash = hashPassword(password);
      const [created] = await tx
        .insert(users)
        .values({
          displayName: cleanName,
          email: normalizedEmail,
          passwordHash,
        })
        .returning();

      await ensurePersonalSpace(created.id, created.displayName, tx);
      return sanitizeUser(created);
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'EMAIL_EXISTS') {
      throw error;
    }
    if (isPgUniqueViolation(error)) {
      throw new Error('EMAIL_EXISTS');
    }
    console.error('Database query failed in registerWithPassword:', error);
    throw new Error('Registration failed. Please try again later.', { cause: error });
  }
}

export async function loginWithPassword(
  email: string,
  password: string
): Promise<PublicUser | null> {
  const normalizedEmail = email.trim().toLowerCase();
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (!user || !user.passwordHash) {
      return null;
    }

    const isValid = verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return null;
    }

    await ensurePersonalSpace(user.id, user.displayName);
    return sanitizeUser(user);
  } catch (error) {
    console.error('Database query failed in loginWithPassword:', error);
    throw new Error('Login failed. Please try again later.', { cause: error });
  }
}

export async function updateUserDisplayName(
  userId: string,
  displayName: string
): Promise<PublicUser> {
  try {
    const [updated] = await db
      .update(users)
      .set({ displayName: displayName.trim() })
      .where(eq(users.id, userId))
      .returning();

    if (!updated) {
      throw new Error('USER_NOT_FOUND');
    }
    return sanitizeUser(updated);
  } catch (error) {
    if (error instanceof Error && error.message === 'USER_NOT_FOUND') throw error;
    console.error('Database query failed in updateUserDisplayName:', error);
    throw new Error('Failed to update profile.', { cause: error });
  }
}
