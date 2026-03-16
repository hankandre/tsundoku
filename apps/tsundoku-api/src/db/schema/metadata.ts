import {
  integer,
  json,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
  index,
} from "drizzle-orm/pg-core";

const uuidv7 = () => Bun.randomUUIDv7();

export const metadataFetchJobs = pgTable("metadata_fetch_jobs", {
  taskId: varchar("task_id", { length: 100 }).primaryKey(),
  userId: uuid("user_id"),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  statusMessage: text("status_message"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  totalBooksCount: integer("total_books_count"),
  completedBooks: integer("completed_books").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
});

export type MetadataFetchJob = typeof metadataFetchJobs.$inferSelect;
export type NewMetadataFetchJob = typeof metadataFetchJobs.$inferInsert;

export const metadataFetchProposals = pgTable("metadata_fetch_proposals", {
  proposalId: uuid("proposal_id").primaryKey().$defaultFn(uuidv7),
  taskId: varchar("task_id", { length: 100 }).notNull(),
  bookId: uuid("book_id").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewerUserId: uuid("reviewer_user_id"),
  status: varchar("status", { length: 30 }).notNull().default("pending"),
  metadataJson: json("metadata_json").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
}, (table) => [
  index("metadata_fetch_proposals_task_idx").on(table.taskId),
  index("metadata_fetch_proposals_book_idx").on(table.bookId),
  index("metadata_fetch_proposals_status_idx").on(table.status),
]);

export type MetadataFetchProposal = typeof metadataFetchProposals.$inferSelect;
export type NewMetadataFetchProposal = typeof metadataFetchProposals.$inferInsert;
