import {
  boolean,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
  json,
  uniqueIndex,
  integer,
} from "drizzle-orm/pg-core";

const uuidv7 = () => Bun.randomUUIDv7();

export const users = pgTable("users", {
  id: uuid("id").primaryKey().$defaultFn(uuidv7),
  username: varchar("username", { length: 255 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  isDefaultPassword: boolean("is_default_password").notNull().default(true),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  provisioningMethod: varchar("provisioning_method", { length: 50 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("users_username_idx").on(table.username),
]);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export const userPermissions = pgTable("user_permissions", {
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  permissionUpload: boolean("permission_upload").notNull().default(false),
  permissionDownload: boolean("permission_download").notNull().default(false),
  permissionEditMetadata: boolean("permission_edit_metadata").notNull().default(false),
  permissionManipulateLibrary: boolean("permission_manipulate_library").notNull().default(false),
  permissionEmailBook: boolean("permission_email_book").notNull().default(false),
  permissionDeleteBook: boolean("permission_delete_book").notNull().default(false),
  permissionAccessOpds: boolean("permission_access_opds").notNull().default(false),
  permissionSyncKoreader: boolean("permission_sync_koreader").notNull().default(false),
  permissionSyncKobo: boolean("permission_sync_kobo").notNull().default(false),
  permissionAdmin: boolean("permission_admin").notNull().default(false),
  permissionManageMetadataConfig: boolean("permission_manage_metadata_config").notNull().default(false),
  permissionAccessBookdrop: boolean("permission_access_bookdrop").notNull().default(false),
  permissionAccessLibraryStats: boolean("permission_access_library_stats").notNull().default(false),
  permissionAccessUserStats: boolean("permission_access_user_stats").notNull().default(false),
  permissionAccessTaskManager: boolean("permission_access_task_manager").notNull().default(false),
  permissionManageGlobalPreferences: boolean("permission_manage_global_preferences").notNull().default(false),
  permissionManageIcons: boolean("permission_manage_icons").notNull().default(false),
  permissionManageFonts: boolean("permission_manage_fonts").notNull().default(false),
  permissionBulkAutoFetchMetadata: boolean("permission_bulk_auto_fetch_metadata").notNull().default(false),
  permissionBulkCustomFetchMetadata: boolean("permission_bulk_custom_fetch_metadata").notNull().default(false),
  permissionBulkEditMetadata: boolean("permission_bulk_edit_metadata").notNull().default(false),
  permissionBulkRegenerateCover: boolean("permission_bulk_regenerate_cover").notNull().default(false),
  permissionMoveOrganizeFiles: boolean("permission_move_organize_files").notNull().default(false),
  permissionBulkLockUnlockMetadata: boolean("permission_bulk_lock_unlock_metadata").notNull().default(false),
  permissionBulkResetBookloreReadProgress: boolean("permission_bulk_reset_booklore_read_progress").notNull().default(false),
  permissionBulkResetKoreaderReadProgress: boolean("permission_bulk_reset_koreader_read_progress").notNull().default(false),
  permissionBulkResetBookReadStatus: boolean("permission_bulk_reset_book_read_status").notNull().default(false),
  isDemoUser: boolean("is_demo_user").notNull().default(false),
}, (table) => [
  primaryKey({ columns: [table.userId] }),
]);

export type UserPermission = typeof userPermissions.$inferSelect;
export type NewUserPermission = typeof userPermissions.$inferInsert;

export const refreshToken = pgTable("refresh_token", {
  id: uuid("id").primaryKey().$defaultFn(uuidv7),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull(),
  expiryDate: timestamp("expiry_date", { withTimezone: true }).notNull(),
  revoked: boolean("revoked").notNull().default(false),
  revocationDate: timestamp("revocation_date", { withTimezone: true }),
}, (table) => [
  uniqueIndex("refresh_token_token_idx").on(table.token),
]);

export type RefreshToken = typeof refreshToken.$inferSelect;
export type NewRefreshToken = typeof refreshToken.$inferInsert;

export const userSettings = pgTable("user_settings", {
  id: uuid("id").primaryKey().$defaultFn(uuidv7),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  settingKey: varchar("setting_key", { length: 100 }).notNull(),
  settingValue: json("setting_value").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("user_settings_user_key_idx").on(table.userId, table.settingKey),
]);

export type UserSetting = typeof userSettings.$inferSelect;
export type NewUserSetting = typeof userSettings.$inferInsert;

export const libraries = pgTable("libraries", {
  id: uuid("id").primaryKey().$defaultFn(uuidv7),
  name: varchar("name", { length: 255 }).notNull(),
  sort: varchar("sort", { length: 255 }),
  icon: varchar("icon", { length: 64 }).notNull(),
  iconType: varchar("icon_type", { length: 50 }),
  fileNamingPattern: varchar("file_naming_pattern", { length: 255 }),
  watch: boolean("watch").notNull().default(false),
  formatPriority: json("format_priority"),
  allowedFormats: json("allowed_formats"),
  organizationMode: varchar("organization_mode", { length: 50 }),
  metadataSource: varchar("metadata_source", { length: 50 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
}, (table) => [
  uniqueIndex("libraries_name_idx").on(table.name),
]);

export type Library = typeof libraries.$inferSelect;
export type NewLibrary = typeof libraries.$inferInsert;

export const libraryPath = pgTable("library_path", {
  id: uuid("id").primaryKey().$defaultFn(uuidv7),
  path: text("path"),
  libraryId: uuid("library_id")
    .notNull()
    .references(() => libraries.id, { onDelete: "cascade" }),
});

export type LibraryPath = typeof libraryPath.$inferSelect;
export type NewLibraryPath = typeof libraryPath.$inferInsert;

export const userLibraryMapping = pgTable(
  "user_library_mapping",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    libraryId: uuid("library_id")
      .notNull()
      .references(() => libraries.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.libraryId] }),
  ]
);

export type UserLibraryMapping = typeof userLibraryMapping.$inferSelect;
export type NewUserLibraryMapping = typeof userLibraryMapping.$inferInsert;
