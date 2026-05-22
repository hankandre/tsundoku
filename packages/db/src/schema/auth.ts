import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users.ts";

export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    expiryDate: timestamp("expiry_date", { withTimezone: true, precision: 6 }).notNull(),
    revoked: boolean("revoked").notNull().default(false),
    revocationDate: timestamp("revocation_date", { withTimezone: true, precision: 6 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    uniqueIndex("uq_refresh_tokens_token").on(t.token),
    index("ix_refresh_tokens_user").on(t.userId),
  ],
);

export const oidcSessions = pgTable(
  "oidc_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    oidcSubject: varchar("oidc_subject", { length: 256 }).notNull(),
    oidcIssuer: varchar("oidc_issuer", { length: 256 }).notNull(),
    oidcSessionId: varchar("oidc_session_id", { length: 256 }),
    idTokenHint: text("id_token_hint"),
    revoked: boolean("revoked").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    index("ix_oidc_sessions_user").on(t.userId),
    index("ix_oidc_sessions_sub_iss").on(t.oidcSubject, t.oidcIssuer),
    index("ix_oidc_sessions_sid").on(t.oidcSessionId),
  ],
);

export const oidcGroupMappings = pgTable("oidc_group_mappings", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupName: varchar("group_name", { length: 256 }).notNull().unique(),
  isAdmin: boolean("is_admin").notNull().default(false),
  // Permission keys e.g. ["upload","edit_metadata"], serialized as JSONB.
  permissions: jsonb("permissions").$type<string[]>().notNull().default([]),
  // Library IDs the group should be granted access to.
  libraryIds: jsonb("library_ids").$type<string[]>().notNull().default([]),
});
