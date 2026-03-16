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

export const mood = pgTable("mood", {
  id: uuid("id").primaryKey().$defaultFn(uuidv7),
  name: varchar("name", { length: 255 }).notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
});

export type Mood = typeof mood.$inferSelect;
export type NewMood = typeof mood.$inferInsert;

export const tag = pgTable("tag", {
  id: uuid("id").primaryKey().$defaultFn(uuidv7),
  name: varchar("name", { length: 255 }).notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
});

export type Tag = typeof tag.$inferSelect;
export type NewTag = typeof tag.$inferInsert;

export const bookMetadataMoodMapping = pgTable(
  "book_metadata_mood_mapping",
  {
    bookId: uuid("book_id").notNull(),
    moodId: uuid("mood_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by"),
  },
  (table) => [
    primaryKey({ columns: [table.bookId, table.moodId] }),
  ]
);

export type BookMetadataMoodMapping = typeof bookMetadataMoodMapping.$inferSelect;
export type NewBookMetadataMoodMapping = typeof bookMetadataMoodMapping.$inferInsert;

export const bookMetadataTagMapping = pgTable(
  "book_metadata_tag_mapping",
  {
    bookId: uuid("book_id").notNull(),
    tagId: uuid("tag_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by"),
  },
  (table) => [
    primaryKey({ columns: [table.bookId, table.tagId] }),
  ]
);

export type BookMetadataTagMapping = typeof bookMetadataTagMapping.$inferSelect;
export type NewBookMetadataTagMapping = typeof bookMetadataTagMapping.$inferInsert;
