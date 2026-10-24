import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').unique(), // Firebase Auth UID
  username: text('username').notNull().unique(),
  password: text('password'),
  role: text('role').default('user'),
  permissions: text('permissions'),
  createdAt: timestamp('created_at').defaultNow(),
  branchId: integer('branch_id'),
  mustChangePassword: boolean('must_change_password').default(false),
});

export const entries = pgTable('entries', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  content: text('content').notNull(),
  date: text('date').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  entries: many(entries),
}));

export const entriesRelations = relations(entries, ({ one }) => ({
  author: one(users, {
    fields: [entries.userId],
    references: [users.id],
  }),
}));
