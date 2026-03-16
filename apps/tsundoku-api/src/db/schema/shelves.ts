import {
  boolean,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./users";

const uuidv7 = () => Bun.randomUUIDv7();

export const shelves = pgTable("shelves", {
  id: uuid("id").primaryKey().$defaultFn(uuidv7),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  sort: varchar("sort", { length: 255 }),
  icon: varchar("icon", { length: 64 }).notNull(),
  iconType: varchar("icon_type", { length: 50 }),
  isPublic: boolean("is_public").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
}, (table) => [
  uniqueIndex("shelves_user_name_idx").on(table.userId, table.name),
]);

export type Shelf = typeof shelves.$inferSelect;
export type NewShelf = typeof shelves.$inferInsert;

export const bookShelfMapping = pgTable(
  "book_shelf_mapping",
  {
    bookId: uuid("book_id").notNull(),
    shelfId: uuid("shelf_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by"),
  },
  (table) => [
    primaryKey({ columns: [table.bookId, table.shelfId] }),
  ]
);

export type BookShelfMapping = typeof bookShelfMapping.$inferSelect;
export type NewBookShelfMapping = typeof bookShelfMapping.$inferInsert;

export const userBookProgress = pgTable("user_book_progress", {
  id: uuid("id").primaryKey().$defaultFn(uuidv7),
  userId: uuid("user_id").notNull(),
  bookId: uuid("book_id").notNull(),
  lastReadTime: timestamp("last_read_time", { withTimezone: true }),
  pdfProgress: integer("pdf_progress"),
  epubProgress: text("epub_progress"),
  readStatus: varchar("read_status", { length: 20 }),
  finished: boolean("finished").default(false),
  personalRating: integer("personal_rating"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
}, (table) => [
  uniqueIndex("user_book_progress_user_book_idx").on(table.userId, table.bookId),
  index("user_book_progress_user_idx").on(table.userId),
  index("user_book_progress_book_idx").on(table.bookId),
]);

export type UserBookProgress = typeof userBookProgress.$inferSelect;
export type NewUserBookProgress = typeof userBookProgress.$inferInsert;

export const epubViewerPreference = pgTable("epub_viewer_preference", {
  id: uuid("id").primaryKey().$defaultFn(uuidv7),
  userId: uuid("user_id").notNull(),
  bookId: uuid("book_id").notNull(),
  theme: varchar("theme", { length: 128 }),
  font: varchar("font", { length: 128 }),
  fontSize: integer("font_size"),
  flow: varchar("flow", { length: 20 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
}, (table) => [
  uniqueIndex("epub_viewer_preference_user_book_idx").on(table.userId, table.bookId),
]);

export type EpubViewerPreference = typeof epubViewerPreference.$inferSelect;
export type NewEpubViewerPreference = typeof epubViewerPreference.$inferInsert;

export const ebookViewerPreference = pgTable("ebook_viewer_preference", {
  id: uuid("id").primaryKey().$defaultFn(uuidv7),
  userId: uuid("user_id").notNull(),
  bookId: uuid("book_id").notNull(),
  fontFamily: varchar("font_family", { length: 128 }),
  fontSize: integer("font_size"),
  gap: integer("gap"),
  hyphenate: boolean("hyphenate"),
  isDark: boolean("is_dark"),
  justify: boolean("justify"),
  lineHeight: integer("line_height"),
  maxBlockSize: integer("max_block_size"),
  maxColumnCount: integer("max_column_count"),
  maxInlineSize: integer("max_inline_size"),
  theme: varchar("theme", { length: 64 }),
  flow: varchar("flow", { length: 32 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
}, (table) => [
  uniqueIndex("ebook_viewer_preference_user_book_idx").on(table.userId, table.bookId),
]);

export type EbookViewerPreference = typeof ebookViewerPreference.$inferSelect;
export type NewEbookViewerPreference = typeof ebookViewerPreference.$inferInsert;

export const appSettings = pgTable("app_settings", {
  id: uuid("id").primaryKey().$defaultFn(uuidv7),
  category: varchar("category", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  value: text("value").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
}, (table) => [
  uniqueIndex("app_settings_category_name_idx").on(table.category, table.name),
]);

export type AppSetting = typeof appSettings.$inferSelect;
export type NewAppSetting = typeof appSettings.$inferInsert;

export const jwtSecret = pgTable("jwt_secret", {
  id: uuid("id").primaryKey().$defaultFn(uuidv7),
  secret: text("secret").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
});

export type JwtSecret = typeof jwtSecret.$inferSelect;
export type NewJwtSecret = typeof jwtSecret.$inferInsert;
