import {
  boolean,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const uuidv7 = () => Bun.randomUUIDv7();

export const koreaderUser = pgTable("koreader_user", {
  id: uuid("id").primaryKey().$defaultFn(uuidv7),
  username: varchar("username", { length: 100 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  passwordMd5: varchar("password_md5", { length: 255 }).notNull(),
  syncEnabled: boolean("sync_enabled"),
  bookloreUserId: uuid("booklore_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
}, (table) => [
  uniqueIndex("koreader_user_username_idx").on(table.username),
]);

export type KoreaderUser = typeof koreaderUser.$inferSelect;
export type NewKoreaderUser = typeof koreaderUser.$inferInsert;
