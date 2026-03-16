import {
  boolean,
  json,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

const uuidv7 = () => Bun.randomUUIDv7();

export const koboUserSettings = pgTable("kobo_user_settings", {
  id: uuid("id").primaryKey().$defaultFn(uuidv7),
  userId: uuid("user_id").notNull().unique(),
  token: varchar("token", { length: 2048 }).notNull(),
  syncEnabled: boolean("sync_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
}, (table) => [
  uniqueIndex("kobo_user_settings_user_idx").on(table.userId),
]);

export type KoboUserSetting = typeof koboUserSettings.$inferSelect;
export type NewKoboUserSetting = typeof koboUserSettings.$inferInsert;

export const koboLibrarySnapshot = pgTable("kobo_library_snapshot", {
  id: uuid("id").primaryKey().$defaultFn(uuidv7),
  userId: uuid("user_id").notNull(),
  createdDate: timestamp("created_date", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
}, (table) => [
  index("kobo_library_snapshot_user_idx").on(table.userId),
]);

export type KoboLibrarySnapshot = typeof koboLibrarySnapshot.$inferSelect;
export type NewKoboLibrarySnapshot = typeof koboLibrarySnapshot.$inferInsert;

export const koboLibrarySnapshotBook = pgTable("kobo_library_snapshot_book", {
  id: uuid("id").primaryKey().$defaultFn(uuidv7),
  snapshotId: uuid("snapshot_id").notNull(),
  bookId: uuid("book_id").notNull(),
  synced: boolean("synced").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
}, (table) => [
  uniqueIndex("kobo_library_snapshot_book_snapshot_book_idx").on(table.snapshotId, table.bookId),
]);

export type KoboLibrarySnapshotBook = typeof koboLibrarySnapshotBook.$inferSelect;
export type NewKoboLibrarySnapshotBook = typeof koboLibrarySnapshotBook.$inferInsert;

export const koboReadingState = pgTable("kobo_reading_state", {
  id: uuid("id").primaryKey().$defaultFn(uuidv7),
  entitlementId: varchar("entitlement_id", { length: 255 }).notNull().unique(),
  created: varchar("created", { length: 255 }),
  lastModified: varchar("last_modified", { length: 255 }),
  priorityTimestamp: varchar("priority_timestamp", { length: 255 }),
  currentBookmarkJson: json("current_bookmark_json"),
  statisticsJson: json("statistics_json"),
  statusInfoJson: json("status_info_json"),
  lastModifiedString: varchar("last_modified_string", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
}, (table) => [
  uniqueIndex("kobo_reading_state_entitlement_idx").on(table.entitlementId),
]);

export type KoboReadingState = typeof koboReadingState.$inferSelect;
export type NewKoboReadingState = typeof koboReadingState.$inferInsert;

export const koboRemovedBooksTracking = pgTable("kobo_removed_books_tracking", {
  id: uuid("id").primaryKey().$defaultFn(uuidv7),
  snapshotId: uuid("snapshot_id").notNull(),
  userId: uuid("user_id").notNull(),
  bookIdSynced: uuid("book_id_synced").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
}, (table) => [
  uniqueIndex("kobo_removed_books_tracking_snapshot_user_book_idx").on(table.snapshotId, table.userId, table.bookIdSynced),
]);

export type KoboRemovedBooksTracking = typeof koboRemovedBooksTracking.$inferSelect;
export type NewKoboRemovedBooksTracking = typeof koboRemovedBooksTracking.$inferInsert;
