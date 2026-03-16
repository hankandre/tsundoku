import {
  json,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
  uniqueIndex,
  bigint,
} from "drizzle-orm/pg-core";

const uuidv7 = () => Bun.randomUUIDv7();

export const bookdropFile = pgTable("bookdrop_file", {
  id: uuid("id").primaryKey().$defaultFn(uuidv7),
  filePath: text("file_path").notNull(),
  fileName: varchar("file_name", { length: 512 }).notNull(),
  fileSize: bigint("file_size", { mode: "number" }),
  status: varchar("status", { length: 20 }).notNull().default("PENDING_REVIEW"),
  originalMetadata: json("original_metadata"),
  fetchedMetadata: json("fetched_metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
}, (table) => [
  uniqueIndex("bookdrop_file_path_idx").on(table.filePath),
]);

export type BookdropFile = typeof bookdropFile.$inferSelect;
export type NewBookdropFile = typeof bookdropFile.$inferInsert;
