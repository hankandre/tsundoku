import {
  pgTable,
  uuid,
  varchar,
  integer,
  text,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users.ts";

export const organizationMode = ["BOOK_PER_FILE", "BOOK_PER_DIRECTORY", "AUTO_DETECT"] as const;
export type OrganizationMode = (typeof organizationMode)[number];

export const libraries = pgTable("libraries", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 256 }).notNull(),
  icon: varchar("icon", { length: 128 }),
  sortOrder: integer("sort_order").notNull().default(0),
  organizationMode: varchar("organization_mode", { length: 32 })
    .$type<OrganizationMode>()
    .notNull()
    .default("BOOK_PER_FILE"),
});

export const libraryPaths = pgTable(
  "library_paths",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    libraryId: uuid("library_id")
      .notNull()
      .references(() => libraries.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
  },
  (t) => [index("ix_library_paths_library").on(t.libraryId)],
);

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
  (t) => [primaryKey({ columns: [t.userId, t.libraryId] })],
);

export const librariesRelations = relations(libraries, ({ many }) => ({
  paths: many(libraryPaths),
}));

export const libraryPathsRelations = relations(libraryPaths, ({ one }) => ({
  library: one(libraries, {
    fields: [libraryPaths.libraryId],
    references: [libraries.id],
  }),
}));
