import {
  boolean,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
  index,
} from "drizzle-orm/pg-core";

const uuidv7 = () => Bun.randomUUIDv7();

export const oidcSession = pgTable("oidc_session", {
  id: uuid("id").primaryKey().$defaultFn(uuidv7),
  userId: uuid("user_id").notNull(),
  oidcSubject: varchar("oidc_subject", { length: 255 }).notNull(),
  oidcIssuer: varchar("oidc_issuer", { length: 512 }).notNull(),
  oidcSessionId: varchar("oidc_session_id", { length: 255 }),
  idTokenHint: text("id_token_hint"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastRefreshedAt: timestamp("last_refreshed_at", { withTimezone: true }),
  revoked: boolean("revoked").default(false),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
}, (table) => [
  index("oidc_session_user_idx").on(table.userId),
  index("oidc_session_subject_idx").on(table.oidcSubject),
  index("oidc_session_sid_idx").on(table.oidcSessionId),
  index("oidc_session_sub_iss_revoked_idx").on(table.oidcSubject, table.oidcIssuer, table.revoked),
]);

export type OidcSession = typeof oidcSession.$inferSelect;
export type NewOidcSession = typeof oidcSession.$inferInsert;

export const oidcGroupMapping = pgTable("oidc_group_mapping", {
  id: uuid("id").primaryKey().$defaultFn(uuidv7),
  groupName: varchar("group_name", { length: 255 }).notNull(),
  permissionAdmin: boolean("permission_admin").default(false),
  permissionManageLibrary: boolean("permission_manage_library").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
});

export type OidcGroupMapping = typeof oidcGroupMapping.$inferSelect;
export type NewOidcGroupMapping = typeof oidcGroupMapping.$inferInsert;
