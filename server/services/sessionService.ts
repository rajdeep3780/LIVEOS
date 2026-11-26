import { eq, lt } from 'drizzle-orm';
import { db } from '../../src/db/index.ts';
import { revokedSessions, users } from '../../src/db/schema.ts';
import type { SessionPayload } from '../lib/auth-crypto.ts';

export async function revokeSessionToken(session: SessionPayload): Promise<void> {
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.delete(revokedSessions).where(lt(revokedSessions.expiresAt, now));

    if (session.exp <= now.getTime()) {
      return;
    }

    const [user] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, session.sub))
      .limit(1);

    if (!user) {
      return;
    }

    await tx
      .insert(revokedSessions)
      .values({
        jti: session.jti,
        userId: session.sub,
        expiresAt: new Date(session.exp),
      })
      .onConflictDoNothing({ target: revokedSessions.jti });
  });
}

export async function isSessionRevoked(jti: string): Promise<boolean> {
  const rows = await db
    .select({ id: revokedSessions.id })
    .from(revokedSessions)
    .where(eq(revokedSessions.jti, jti))
    .limit(1);

  return rows.length > 0;
}

export async function pruneExpiredRevokedSessions(): Promise<number> {
  const deleted = await db
    .delete(revokedSessions)
    .where(lt(revokedSessions.expiresAt, new Date()))
    .returning({ id: revokedSessions.id });

  return deleted.length;
}
