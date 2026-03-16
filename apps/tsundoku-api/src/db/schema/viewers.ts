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

export const newPdfViewerPreference = pgTable("new_pdf_viewer_preference", {
  id: uuid("id").primaryKey().$defaultFn(uuidv7),
  userId: uuid("user_id").notNull(),
  bookId: uuid("book_id").notNull(),
  spread: varchar("spread", { length: 16 }),
  viewMode: varchar("view_mode", { length: 16 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
}, (table) => [
  uniqueIndex("new_pdf_viewer_preference_user_book_idx").on(table.userId, table.bookId),
]);

export type NewPdfViewerPreference = typeof newPdfViewerPreference.$inferSelect;
export type NewNewPdfViewerPreference = typeof newPdfViewerPreference.$inferInsert;

export const cbxViewerPreference = pgTable("cbx_viewer_preference", {
  id: uuid("id").primaryKey().$defaultFn(uuidv7),
  userId: uuid("user_id").notNull(),
  bookId: uuid("book_id").notNull(),
  backgroundColor: varchar("background_color", { length: 20 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
}, (table) => [
  uniqueIndex("cbx_viewer_preference_user_book_idx").on(table.userId, table.bookId),
]);

export type CbxViewerPreference = typeof cbxViewerPreference.$inferSelect;
export type NewCbxViewerPreference = typeof cbxViewerPreference.$inferInsert;

export const customFont = pgTable("custom_font", {
  id: uuid("id").primaryKey().$defaultFn(uuidv7),
  userId: uuid("user_id").notNull(),
  fontName: varchar("font_name", { length: 255 }).notNull(),
  fileName: varchar("file_name", { length: 255 }).notNull().unique(),
  originalFileName: varchar("original_file_name", { length: 255 }).notNull(),
  format: varchar("format", { length: 10 }).notNull(),
  fileSize: integer("file_size").notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid("created_by"),
}, (table) => [
  index("custom_font_user_idx").on(table.userId),
]);

export type CustomFont = typeof customFont.$inferSelect;
export type NewCustomFont = typeof customFont.$inferInsert;

export const publicBookReview = pgTable("public_book_review", {
  id: uuid("id").primaryKey().$defaultFn(uuidv7),
  bookId: uuid("book_id").notNull(),
  userId: uuid("user_id").notNull(),
  rating: integer("rating").notNull(),
  reviewText: text("review_text"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
}, (table) => [
  index("public_book_review_book_idx").on(table.bookId),
  index("public_book_review_user_idx").on(table.userId),
]);

export type PublicBookReview = typeof publicBookReview.$inferSelect;
export type NewPublicBookReview = typeof publicBookReview.$inferInsert;

export const appMigration = pgTable("app_migration", {
  id: uuid("id").primaryKey().$defaultFn(uuidv7),
  appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().defaultNow(),
  checksum: varchar("checksum", { length: 64 }).notNull(),
  version: varchar("version", { length: 50 }).notNull(),
  description: text("description"),
});

export type AppMigration = typeof appMigration.$inferSelect;
export type NewAppMigration = typeof appMigration.$inferInsert;
