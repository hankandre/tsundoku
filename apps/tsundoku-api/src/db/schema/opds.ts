import {
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

const uuidv7 = () => Bun.randomUUIDv7();

export const opdsUserV2 = pgTable("opds_user_v2", {
  id: uuid("id").primaryKey().$defaultFn(uuidv7),
  userId: uuid("user_id").notNull(),
  username: varchar("username", { length: 100 }).notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  sortOrder: varchar("sort_order", { length: 20 }).default("recent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("opds_user_v2_user_username_idx").on(table.userId, table.username),
]);

export type OpdsUserV2 = typeof opdsUserV2.$inferSelect;
export type NewOpdsUserV2 = typeof opdsUserV2.$inferInsert;
