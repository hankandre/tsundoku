import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const appSettings = pgTable(
  "app_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    category: varchar("category", { length: 128 }).notNull(),
    name: varchar("name", { length: 128 }).notNull(),
    val: jsonb("val"),
  },
  (t) => [uniqueIndex("uq_app_settings_category_name").on(t.category, t.name)],
);

export const customFonts = pgTable("custom_fonts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 128 }).notNull().unique(),
  fileName: varchar("file_name", { length: 256 }).notNull(),
  mimeType: varchar("mime_type", { length: 64 }).notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const customIcons = pgTable("custom_icons", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 128 }).notNull().unique(),
  fileName: varchar("file_name", { length: 256 }).notNull(),
  mimeType: varchar("mime_type", { length: 64 }).notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Nullable foreign-key style — anonymized/system rows have no user.
  userId: uuid("user_id"),
  username: varchar("username", { length: 128 }),
  action: varchar("action", { length: 64 }).notNull(),
  entityType: varchar("entity_type", { length: 64 }),
  entityId: varchar("entity_id", { length: 128 }),
  ipAddress: varchar("ip_address", { length: 64 }),
  countryCode: varchar("country_code", { length: 8 }),
  detail: text("detail"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});
