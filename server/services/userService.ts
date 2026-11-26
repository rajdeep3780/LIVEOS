import { and, eq } from 'drizzle-orm';
import { db } from '../../src/db/index.ts';
import { spaceMemberships, spaces, users } from '../../src/db/schema.ts';
import { hashPassword, verifyPassword } from '../lib/auth-crypto.ts';

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

export async function ensurePersonalSpace(userId: string, displayName: string): Promise<void> {
  try {
    const existing = await db
      .select({ id: spaces.id })
      .from(spaces)
      .innerJoin(spaceMemberships, eq(spaceMemberships.spaceId, spaces.id))
      .where(and(eq(spaceMemberships.userId, userId), eq(spaces.type, 'personal')))
      .limit(1);

    if (existing.length > 0) return;

    const firstName = displayName.trim().split(/\s+/)[0] || 'My';
    const [createdSpace] = await db
      .insert(spaces)
      .values({
        name: `${firstName}'s Personal Space`,
        type: 'personal',
        description: 'Private personal responsibilities, follow-ups, and life matters.',
        createdBy: userId,
      })
      .returning();

    await db
      .insert(spaceMemberships)
      .values({
        spaceId: createdSpace.id,
        userId,
        role: 'owner',
      })
      .onConflictDoNothing();
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
    const existingByUid = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    if (existingByUid.length > 0) {
      const current = existingByUid[0];
      if (current.email !== normalizedEmail) {
        const [updated] = await db
          .update(users)
          .set({ email: normalizedEmail })
          .where(eq(users.id, current.id))
          .returning();
        await ensurePersonalSpace(updated.id, updated.displayName);
        return sanitizeUser(updated);
      }
      await ensurePersonalSpace(current.id, current.displayName);
      return sanitizeUser(current);
    }

    const existingByEmail = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existingByEmail.length > 0) {
      const [linked] = await db
        .update(users)
        .set({ uid })
        .where(eq(users.id, existingByEmail[0].id))
        .returning();
      await ensurePersonalSpace(linked.id, linked.displayName);
      return sanitizeUser(linked);
    }

    const [inserted] = await db
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

    await ensurePersonalSpace(inserted.id, inserted.displayName);
    return sanitizeUser(inserted);
  } catch (error) {
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
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existing.length > 0) {
      throw new Error('EMAIL_EXISTS');
    }

    const passwordHash = hashPassword(password);
    const [created] = await db
      .insert(users)
      .values({
        displayName: cleanName,
        email: normalizedEmail,
        passwordHash,
      })
      .returning();

    await ensurePersonalSpace(created.id, created.displayName);
    return sanitizeUser(created);
  } catch (error) {
    if (error instanceof Error && error.message === 'EMAIL_EXISTS') {
      throw error;
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
