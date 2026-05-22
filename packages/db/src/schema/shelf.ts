import {
  pgTable,
  uuid,
  varchar,
  integer,
  jsonb,
  primaryKey,
  index,
  uniqueIndex,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users.ts";
import { books } from "./book.ts";

// Wire-compatible with upstream booklore's `filter_json`: a recursive tree where
// groups combine children with AND/OR and leaves are field/operator/value triples.
// The arktype validator + evaluator live alongside the API routes; this is just
// the structural type that brands the jsonb column for read sites.
export type MagicShelfJoin = "and" | "or";

export type MagicShelfRule = {
  type: "rule";
  field: string;
  operator: string;
  value?: unknown;
  valueStart?: unknown;
  valueEnd?: unknown;
};

export type MagicShelfGroup = {
  type: "group";
  join: MagicShelfJoin;
  rules: Array<MagicShelfRule | MagicShelfGroup>;
};

export type MagicShelfRules = MagicShelfGroup;

const EMPTY_RULES_DEFAULT = sql`'{"type":"group","join":"and","rules":[]}'::jsonb`;

export const shelves = pgTable(
  "shelves",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 256 }).notNull(),
    icon: varchar("icon", { length: 128 }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("ix_shelves_user").on(t.userId)],
);

export const bookShelfMapping = pgTable(
  "book_shelf_mapping",
  {
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    shelfId: uuid("shelf_id")
      .notNull()
      .references(() => shelves.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.bookId, t.shelfId] })],
);

export const magicShelves = pgTable(
  "magic_shelves",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 256 }).notNull(),
    icon: varchar("icon", { length: 128 }),
    isPublic: boolean("is_public").notNull().default(false),
    rules: jsonb("rules").$type<MagicShelfRules>().notNull().default(EMPTY_RULES_DEFAULT),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("ix_magic_shelves_user").on(t.userId),
    uniqueIndex("uq_magic_shelves_user_name").on(t.userId, t.name),
  ],
);
