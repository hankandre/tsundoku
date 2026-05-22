import {
  pgTable,
  uuid,
  integer,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    username: varchar("username", { length: 128 }).notNull(),
    passwordHash: text("password_hash"),
    name: varchar("name", { length: 256 }),
    email: varchar("email", { length: 256 }),

    // OIDC linkage. Null for local users; unique together when set.
    oidcSubject: varchar("oidc_subject", { length: 256 }),
    oidcIssuer: varchar("oidc_issuer", { length: 256 }),
    avatarUrl: text("avatar_url"),

    bookPreferences: jsonb("book_preferences").$type<Record<string, unknown>>(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    uniqueIndex("uq_users_username").on(t.username),
    // Postgres treats NULL as distinct in unique indexes, matching the MariaDB
    // V127 behavior the original schema relies on for local-vs-OIDC users.
    uniqueIndex("uq_users_oidc_issuer_subject").on(t.oidcIssuer, t.oidcSubject),
  ],
);

export const userPermissions = pgTable("user_permissions", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  upload: boolean("upload").notNull().default(false),
  download: boolean("download").notNull().default(true),
  editMetadata: boolean("edit_metadata").notNull().default(false),
  manipulateLibrary: boolean("manipulate_library").notNull().default(false),
  admin: boolean("admin").notNull().default(false),
});

export const userSettings = pgTable(
  "user_settings",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    settingKey: varchar("setting_key", { length: 128 }).notNull(),
    settingValue: jsonb("setting_value"),
  },
  (t) => [primaryKey({ columns: [t.userId, t.settingKey] })],
);

export const userContentRestriction = pgTable("user_content_restriction", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  maxAgeRating: varchar("max_age_rating", { length: 32 }),
});

export const emailRecipients = pgTable(
  "email_recipients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 128 }).notNull(),
    email: varchar("email", { length: 256 }).notNull(),
  },
  (t) => [uniqueIndex("uq_email_recipients_user_email").on(t.userId, t.email)],
);

export const komgaSettings = pgTable("komga_settings", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  baseUrl: text("base_url"),
  username: varchar("username", { length: 256 }),
  password: text("password"), // basic auth credential; stored plain for now
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
});

export const hardcoverSettings = pgTable("hardcover_settings", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  apiToken: text("api_token"), // stored as-is; consider encryption later
  syncEnabled: boolean("sync_enabled").notNull().default(false),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
});

export const deviceUsers = pgTable(
  "device_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deviceType: varchar("device_type", { length: 32 }).notNull(), // kobo / koreader / opds
    label: varchar("label", { length: 128 }).notNull(),
    tokenHash: text("token_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("uq_device_users_user_type_label").on(t.userId, t.deviceType, t.label)],
);

export const emailProviders = pgTable(
  "email_providers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 128 }).notNull(),
    host: varchar("host", { length: 256 }).notNull(),
    port: integer("port").notNull().default(587),
    secure: boolean("secure").notNull().default(false),
    username: varchar("username", { length: 256 }),
    passwordCipher: text("password_cipher"),
    fromAddress: varchar("from_address", { length: 256 }).notNull(),
    isDefault: boolean("is_default").notNull().default(false),
  },
);

export const usersRelations = relations(users, ({ one, many }) => ({
  permissions: one(userPermissions, {
    fields: [users.id],
    references: [userPermissions.userId],
  }),
  contentRestriction: one(userContentRestriction, {
    fields: [users.id],
    references: [userContentRestriction.userId],
  }),
  settings: many(userSettings),
}));
