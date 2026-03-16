import {
  boolean,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const uuidv7 = () => Bun.randomUUIDv7();

export const emailProviderV2 = pgTable("email_provider_v2", {
  id: uuid("id").primaryKey().$defaultFn(uuidv7),
  userId: uuid("user_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  host: varchar("host", { length: 255 }).notNull(),
  port: integer("port").notNull(),
  username: varchar("username", { length: 255 }).notNull(),
  password: text("password").notNull(),
  fromAddress: varchar("from_address", { length: 255 }),
  auth: boolean("auth").notNull(),
  startTls: boolean("start_tls").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
}, (table) => [
  uniqueIndex("email_provider_v2_user_name_idx").on(table.userId, table.name),
  index("email_provider_v2_user_idx").on(table.userId),
]);

export type EmailProviderV2 = typeof emailProviderV2.$inferSelect;
export type NewEmailProviderV2 = typeof emailProviderV2.$inferInsert;

export const emailRecipientV2 = pgTable("email_recipient_v2", {
  id: uuid("id").primaryKey().$defaultFn(uuidv7),
  userId: uuid("user_id").notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid("created_by"),
}, (table) => [
  uniqueIndex("email_recipient_v2_user_email_idx").on(table.userId, table.email),
  index("email_recipient_v2_user_idx").on(table.userId),
]);

export type EmailRecipientV2 = typeof emailRecipientV2.$inferSelect;
export type NewEmailRecipientV2 = typeof emailRecipientV2.$inferInsert;

export const userEmailProviderPreference = pgTable("user_email_provider_preference", {
  id: uuid("id").primaryKey().$defaultFn(uuidv7),
  userId: uuid("user_id").notNull(),
  providerId: uuid("provider_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid("created_by"),
});

export type UserEmailProviderPreference = typeof userEmailProviderPreference.$inferSelect;
export type NewUserEmailProviderPreference = typeof userEmailProviderPreference.$inferInsert;
