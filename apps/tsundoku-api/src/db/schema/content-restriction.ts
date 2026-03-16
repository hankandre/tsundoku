import {
  pgTable,
  primaryKey,
  timestamp,
  uuid,
  varchar,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const uuidv7 = () => Bun.randomUUIDv7();

export const userContentRestriction = pgTable("user_content_restriction", {
  id: uuid("id").primaryKey().$defaultFn(uuidv7),
  userId: uuid("user_id").notNull(),
  restrictionType: varchar("restriction_type", { length: 20 }).notNull(),
  mode: varchar("mode", { length: 15 }).notNull(),
  value: varchar("value", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid("created_by"),
}, (table) => [
  uniqueIndex("user_content_restriction_user_restriction_idx").on(table.userId, table.restrictionType, table.value),
  index("user_content_restriction_user_idx").on(table.userId),
]);

export type UserContentRestriction = typeof userContentRestriction.$inferSelect;
export type NewUserContentRestriction = typeof userContentRestriction.$inferInsert;
