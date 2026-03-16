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

export const comicMetadata = pgTable("comic_metadata", {
  bookId: uuid("book_id").primaryKey(),
  issueNumber: varchar("issue_number", { length: 50 }),
  volumeName: varchar("volume_name", { length: 255 }),
  volumeNumber: integer("volume_number"),
  storyArc: varchar("story_arc", { length: 255 }),
  storyArcNumber: integer("story_arc_number"),
  alternateSeries: varchar("alternate_series", { length: 255 }),
  alternateIssue: varchar("alternate_issue", { length: 50 }),
  imprint: varchar("imprint", { length: 255 }),
  format: varchar("format", { length: 50 }),
  blackAndWhite: boolean("black_and_white").default(false),
  manga: boolean("manga").default(false),
  readingDirection: varchar("reading_direction", { length: 10 }).default("ltr"),
  webLink: varchar("web_link", { length: 1000 }),
  notes: text("notes"),
  issueNumberLocked: boolean("issue_number_locked").default(false),
  volumeNameLocked: boolean("volume_name_locked").default(false),
  volumeNumberLocked: boolean("volume_number_locked").default(false),
  storyArcLocked: boolean("story_arc_locked").default(false),
  creatorsLocked: boolean("creators_locked").default(false),
  charactersLocked: boolean("characters_locked").default(false),
  teamsLocked: boolean("teams_locked").default(false),
  locationsLocked: boolean("locations_locked").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
}, (table) => [
  index("comic_metadata_story_arc_idx").on(table.storyArc),
  index("comic_metadata_volume_name_idx").on(table.volumeName),
]);

export type ComicMetadata = typeof comicMetadata.$inferSelect;
export type NewComicMetadata = typeof comicMetadata.$inferInsert;

export const comicCharacter = pgTable("comic_character", {
  id: uuid("id").primaryKey().$defaultFn(uuidv7),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
}, (table) => [
  uniqueIndex("comic_character_name_idx").on(table.name),
]);

export type ComicCharacter = typeof comicCharacter.$inferSelect;
export type NewComicCharacter = typeof comicCharacter.$inferInsert;

export const comicTeam = pgTable("comic_team", {
  id: uuid("id").primaryKey().$defaultFn(uuidv7),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
}, (table) => [
  uniqueIndex("comic_team_name_idx").on(table.name),
]);

export type ComicTeam = typeof comicTeam.$inferSelect;
export type NewComicTeam = typeof comicTeam.$inferInsert;

export const comicLocation = pgTable("comic_location", {
  id: uuid("id").primaryKey().$defaultFn(uuidv7),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
}, (table) => [
  uniqueIndex("comic_location_name_idx").on(table.name),
]);

export type ComicLocation = typeof comicLocation.$inferSelect;
export type NewComicLocation = typeof comicLocation.$inferInsert;

export const comicCreator = pgTable("comic_creator", {
  id: uuid("id").primaryKey().$defaultFn(uuidv7),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
}, (table) => [
  uniqueIndex("comic_creator_name_idx").on(table.name),
]);

export type ComicCreator = typeof comicCreator.$inferSelect;
export type NewComicCreator = typeof comicCreator.$inferInsert;

export const comicMetadataCharacterMapping = pgTable(
  "comic_metadata_character_mapping",
  {
    bookId: uuid("book_id").notNull(),
    characterId: uuid("character_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by"),
  },
  (table) => [
    primaryKey({ columns: [table.bookId, table.characterId] }),
  ]
);

export type ComicMetadataCharacterMapping = typeof comicMetadataCharacterMapping.$inferSelect;
export type NewComicMetadataCharacterMapping = typeof comicMetadataCharacterMapping.$inferInsert;

export const comicMetadataTeamMapping = pgTable(
  "comic_metadata_team_mapping",
  {
    bookId: uuid("book_id").notNull(),
    teamId: uuid("team_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by"),
  },
  (table) => [
    primaryKey({ columns: [table.bookId, table.teamId] }),
  ]
);

export type ComicMetadataTeamMapping = typeof comicMetadataTeamMapping.$inferSelect;
export type NewComicMetadataTeamMapping = typeof comicMetadataTeamMapping.$inferInsert;

export const comicMetadataLocationMapping = pgTable(
  "comic_metadata_location_mapping",
  {
    bookId: uuid("book_id").notNull(),
    locationId: uuid("location_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by"),
  },
  (table) => [
    primaryKey({ columns: [table.bookId, table.locationId] }),
  ]
);

export type ComicMetadataLocationMapping = typeof comicMetadataLocationMapping.$inferSelect;
export type NewComicMetadataLocationMapping = typeof comicMetadataLocationMapping.$inferInsert;

export const comicMetadataCreatorMapping = pgTable(
  "comic_metadata_creator_mapping",
  {
    id: uuid("id").primaryKey().$defaultFn(uuidv7),
    bookId: uuid("book_id").notNull(),
    creatorId: uuid("creator_id").notNull(),
    role: varchar("role", { length: 20 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
    createdBy: uuid("created_by"),
    updatedBy: uuid("updated_by"),
  },
  (table) => [
    index("comic_metadata_creator_mapping_role_idx").on(table.role),
    index("comic_metadata_creator_mapping_book_idx").on(table.bookId),
  ]
);

export type ComicMetadataCreatorMapping = typeof comicMetadataCreatorMapping.$inferSelect;
export type NewComicMetadataCreatorMapping = typeof comicMetadataCreatorMapping.$inferInsert;
