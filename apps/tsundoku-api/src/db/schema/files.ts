import {
  boolean,
  integer,
  json,
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

export const bookFile = pgTable("book_file", {
  id: uuid("id").primaryKey().$defaultFn(uuidv7),
  bookId: uuid("book_id").notNull(),
  fileName: varchar("file_name", { length: 1000 }).notNull(),
  fileSubPath: varchar("file_sub_path", { length: 512 }).notNull(),
  fileSizeKb: integer("file_size_kb"),
  initialHash: varchar("initial_hash", { length: 128 }),
  currentHash: varchar("current_hash", { length: 128 }),
  description: text("description"),
  isBook: boolean("is_book").default(false),
  bookType: varchar("book_type", { length: 32 }),
  archiveType: varchar("archive_type", { length: 255 }),
  altFormatCurrentHash: varchar("alt_format_current_hash", { length: 128 }),
  isFolderBased: boolean("is_folder_based").default(false),
  durationSeconds: integer("duration_seconds"),
  bitrate: integer("bitrate"),
  sampleRate: integer("sample_rate"),
  channels: integer("channels"),
  codec: varchar("codec", { length: 50 }),
  chapterCount: integer("chapter_count"),
  chaptersJson: json("chapters_json"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
}, (table) => [
  index("book_file_book_idx").on(table.bookId),
  uniqueIndex("book_file_current_hash_idx").on(table.altFormatCurrentHash),
]);

export type BookFile = typeof bookFile.$inferSelect;
export type NewBookFile = typeof bookFile.$inferInsert;

export const userBookFileProgress = pgTable("user_book_file_progress", {
  id: uuid("id").primaryKey().$defaultFn(uuidv7),
  userId: uuid("user_id").notNull(),
  bookFileId: uuid("book_file_id").notNull(),
  positionData: varchar("position_data", { length: 1000 }),
  positionHref: varchar("position_href", { length: 1000 }),
  progressPercent: integer("progress_percent"),
  lastReadTime: timestamp("last_read_time", { withTimezone: true }),
  ttsPositionCfi: varchar("tts_position_cfi", { length: 1000 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
}, (table) => [
  uniqueIndex("user_book_file_progress_user_book_idx").on(table.userId, table.bookFileId),
  index("user_book_file_progress_user_book_file_idx").on(table.userId, table.bookFileId),
]);

export type UserBookFileProgress = typeof userBookFileProgress.$inferSelect;
export type NewUserBookFileProgress = typeof userBookFileProgress.$inferInsert;
