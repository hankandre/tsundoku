import {
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
  index,
} from "drizzle-orm/pg-core";

const uuidv7 = () => Bun.randomUUIDv7();

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().$defaultFn(uuidv7),
  userId: uuid("user_id"),
  username: varchar("username", { length: 255 }).notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  entityType: varchar("entity_type", { length: 100 }),
  entityId: uuid("entity_id"),
  description: varchar("description", { length: 1024 }).notNull(),
  ipAddress: varchar("ip_address", { length: 45 }),
  countryCode: varchar("country_code", { length: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid("created_by"),
}, (table) => [
  index("audit_log_created_at_idx").on(table.createdAt),
  index("audit_log_user_id_idx").on(table.userId),
  index("audit_log_action_idx").on(table.action),
]);

export type AuditLog = typeof auditLog.$inferSelect;
export type NewAuditLog = typeof auditLog.$inferInsert;
