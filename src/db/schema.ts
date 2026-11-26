import { relations, sql } from 'drizzle-orm';
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  uid: text('uid').unique(),
  displayName: text('display_name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const spaces = pgTable(
  'spaces',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    type: text('type').notNull(), // 'personal' | 'family' | 'community'
    description: text('description').default('').notNull(),
    createdBy: uuid('created_by')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_spaces_created_by').on(table.createdBy),
    uniqueIndex('uq_spaces_personal_owner')
      .on(table.createdBy)
      .where(sql`${table.type} = 'personal'`),
    check(
      'chk_spaces_type',
      sql`${table.type} IN ('personal', 'family', 'community')`
    ),
  ]
);

export const spaceMemberships = pgTable(
  'space_memberships',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    spaceId: uuid('space_id')
      .references(() => spaces.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    role: text('role').default('member').notNull(), // 'owner' | 'admin' | 'member'
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_space_memberships_space_user').on(table.spaceId, table.userId),
    index('idx_space_memberships_user_id').on(table.userId),
    check(
      'chk_space_memberships_role',
      sql`${table.role} IN ('owner', 'admin', 'member')`
    ),
  ]
);

export const matters = pgTable(
  'matters',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    spaceId: uuid('space_id')
      .references(() => spaces.id, { onDelete: 'cascade' })
      .notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    description: text('description').default('').notNull(),
    category: text('category').default('General').notNull(),
    status: text('status').default('Open').notNull(), // 'Open' | 'In Progress' | 'Waiting' | 'Completed' | 'Archived'
    priority: text('priority').default('Normal').notNull(), // 'Low' | 'Normal' | 'High'
    waitingFor: text('waiting_for'),
    nextAction: text('next_action'),
    nextActionAt: timestamp('next_action_at', { withTimezone: true }),
    dueAt: timestamp('due_at', { withTimezone: true }),
    resolution: text('resolution'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_matters_space_id').on(table.spaceId),
    index('idx_matters_owner_id').on(table.ownerId),
    index('idx_matters_status').on(table.status),
    index('idx_matters_next_action_at').on(table.nextActionAt),
    check(
      'chk_matters_status',
      sql`${table.status} IN ('Open', 'In Progress', 'Waiting', 'Completed', 'Archived')`
    ),
    check(
      'chk_matters_priority',
      sql`${table.priority} IN ('Low', 'Normal', 'High')`
    ),
  ]
);

export const matterParticipants = pgTable(
  'matter_participants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    matterId: uuid('matter_id')
      .references(() => matters.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    addedAt: timestamp('added_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_matter_participants_matter_user').on(table.matterId, table.userId),
    index('idx_matter_participants_user_id').on(table.userId),
  ]
);

export const matterUpdates = pgTable(
  'matter_updates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    matterId: uuid('matter_id')
      .references(() => matters.id, { onDelete: 'cascade' })
      .notNull(),
    authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
    updateType: text('update_type').default('note').notNull(),
    message: text('message').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_matter_updates_matter_id').on(table.matterId),
    index('idx_matter_updates_created_at').on(table.createdAt),
  ]
);

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    matterId: uuid('matter_id').references(() => matters.id, { onDelete: 'cascade' }),
    message: text('message').notNull(),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_notifications_user_id').on(table.userId),
    index('idx_notifications_read_at').on(table.readAt),
  ]
);

export const revokedSessions = pgTable(
  'revoked_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    jti: text('jti').notNull().unique(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_revoked_sessions_expires_at').on(table.expiresAt),
    index('idx_revoked_sessions_user_id').on(table.userId),
  ]
);

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(spaceMemberships),
  ownedMatters: many(matters, { relationName: 'matterOwner' }),
  createdMatters: many(matters, { relationName: 'matterCreator' }),
  participantLinks: many(matterParticipants),
  updates: many(matterUpdates),
  notifications: many(notifications),
}));

export const spacesRelations = relations(spaces, ({ one, many }) => ({
  creator: one(users, {
    fields: [spaces.createdBy],
    references: [users.id],
  }),
  memberships: many(spaceMemberships),
  matters: many(matters),
}));

export const spaceMembershipsRelations = relations(spaceMemberships, ({ one }) => ({
  space: one(spaces, {
    fields: [spaceMemberships.spaceId],
    references: [spaces.id],
  }),
  user: one(users, {
    fields: [spaceMemberships.userId],
    references: [users.id],
  }),
}));

export const mattersRelations = relations(matters, ({ one, many }) => ({
  space: one(spaces, {
    fields: [matters.spaceId],
    references: [spaces.id],
  }),
  creator: one(users, {
    fields: [matters.createdBy],
    references: [users.id],
    relationName: 'matterCreator',
  }),
  owner: one(users, {
    fields: [matters.ownerId],
    references: [users.id],
    relationName: 'matterOwner',
  }),
  participants: many(matterParticipants),
  updates: many(matterUpdates),
  notifications: many(notifications),
}));

export const matterParticipantsRelations = relations(matterParticipants, ({ one }) => ({
  matter: one(matters, {
    fields: [matterParticipants.matterId],
    references: [matters.id],
  }),
  user: one(users, {
    fields: [matterParticipants.userId],
    references: [users.id],
  }),
}));

export const matterUpdatesRelations = relations(matterUpdates, ({ one }) => ({
  matter: one(matters, {
    fields: [matterUpdates.matterId],
    references: [matters.id],
  }),
  author: one(users, {
    fields: [matterUpdates.authorId],
    references: [users.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  matter: one(matters, {
    fields: [notifications.matterId],
    references: [matters.id],
  }),
}));
