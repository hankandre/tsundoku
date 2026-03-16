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

export const bookMarks = pgTable("book_marks", {
  id: uuid("id").primaryKey().$defaultFn(uuidv7),
  userId: uuid("user_id").notNull(),
  bookId: uuid("book_id").notNull(),
  cfi: varchar("cfi", { length: 1000 }).notNull(),
  title: varchar("title", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid("created_by"),
}, (table) => [
  uniqueIndex("book_marks_user_book_cfi_idx").on(table.userId, table.bookId, table.cfi),
  index("book_marks_user_created_idx").on(table.userId, table.createdAt.desc()),
  index("book_marks_book_idx").on(table.bookId),
]);

export type BookMark = typeof bookMarks.$inferSelect;
export type NewBookMark = typeof bookMarks.$inferInsert;

export const readingSessions = pgTable("reading_sessions", {
  id: uuid("id").primaryKey().$defaultFn(uuidv7),
  userId: uuid("user_id").notNull(),
  bookId: uuid("book_id").notNull(),
  bookType: varchar("book_type", { length: 10 }).notNull(),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }).notNull(),
  durationSeconds: integer("duration_seconds").notNull(),
  startProgress: integer("start_progress").notNull(),
  endProgress: integer("end_progress").notNull(),
  progressDelta: integer("progress_delta").notNull(),
  startLocation: varchar("start_location", { length: 500 }).notNull(),
  endLocation: varchar("end_location", { length: 500 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid("created_by"),
}, (table) => [
  index("reading_sessions_user_time_idx").on(table.userId, table.startTime),
  index("reading_sessions_book_time_idx").on(table.bookId, table.startTime),
  index("reading_sessions_user_book_time_idx").on(table.userId, table.bookId, table.startTime),
]);

export type ReadingSession = typeof readingSessions.$inferSelect;
export type NewReadingSession = typeof readingSessions.$inferInsert;

export const magicShelf = pgTable("magic_shelf", {
  id: uuid("id").primaryKey().$defaultFn(uuidv7),
  userId: uuid("user_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  icon: varchar("icon", { length: 64 }).notNull(),
  filterJson: text("filter_json").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
}, (table) => [
  uniqueIndex("magic_shelf_user_name_idx").on(table.userId, table.name),
]);

export type MagicShelf = typeof magicShelf.$inferSelect;
export type NewMagicShelf = typeof magicShelf.$inferInsert;
