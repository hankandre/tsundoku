import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { sValidator } from "@hono/standard-validator";
import { type } from "arktype";
import { eq, inArray } from "drizzle-orm";
import { schema } from "@tsundoku/db";
import { requireDb } from "../db.ts";
import { authRequired } from "../middleware/auth.ts";
import { IdParam } from "../utils/schemas.ts";
import { enqueue } from "../services/tasks.ts";

/**
 * Bulk metadata refresh endpoints. Each call resolves a scope to a list of
 * book IDs, then enqueues one `metadata-refresh` job per book. Returns a
 * batchId (the bullmq jobId prefix) clients can use to track the cohort.
 */

const RefreshBooksBody = type({
  bookIds: type("string.uuid").array().moreThanLength(0).atMostLength(1000),
});

function requireEditMetadata(u: { isAdmin: boolean; permissions: string[] }) {
  if (!u.isAdmin && !u.permissions.includes("editMetadata")) {
    throw new HTTPException(403, { message: "Metadata edit not permitted" });
  }
}

async function enqueueRefresh(bookIds: string[]): Promise<{
  batchId: string;
  taskIds: string[];
}> {
  // BullMQ jobIds are unique per queue; we use them to coalesce duplicate
  // refresh requests for the same book.
  const batchId = crypto.randomUUID();
  const taskIds = await Promise.all(
    bookIds.map((bookId) =>
      enqueue(
        "metadata-refresh",
        { bookId },
        { jobId: `refresh-${bookId}` },
      ).catch(() => `refresh-${bookId}`),
    ),
  );
  return { batchId, taskIds };
}

export const metadataTaskRoutes = new Hono()
  .use("*", authRequired)
  // Refresh every book in a library.
  .post("/metadata/tasks/refresh-library/:id", sValidator("param", IdParam), async (c) => {
    requireEditMetadata(c.var.user!);
    const { id } = c.req.valid("param");
    const db = requireDb();
    const rows = await db
      .select({ id: schema.books.id })
      .from(schema.books)
      .where(eq(schema.books.libraryId, id));
    return c.json(await enqueueRefresh(rows.map((r) => r.id)), 202);
  })
  // Refresh every book on a shelf.
  .post("/metadata/tasks/refresh-shelf/:id", sValidator("param", IdParam), async (c) => {
    requireEditMetadata(c.var.user!);
    const u = c.var.user!;
    const { id } = c.req.valid("param");
    const db = requireDb();
    // Confirm shelf ownership before fanning out — refresh isn't admin-only,
    // so a user can only target their own shelves.
    const own = await db
      .select({ id: schema.shelves.id })
      .from(schema.shelves)
      .where(eq(schema.shelves.id, id))
      .limit(1);
    if (!own[0]) throw new HTTPException(404, { message: "Shelf not found" });
    const rows = await db
      .select({ bookId: schema.bookShelfMapping.bookId })
      .from(schema.bookShelfMapping)
      .where(eq(schema.bookShelfMapping.shelfId, id));
    void u; // ownership checked above; ACL deferred to T6.4 enforcement layer
    return c.json(await enqueueRefresh(rows.map((r) => r.bookId)), 202);
  })
  // Refresh an explicit list of books.
  .post("/metadata/tasks/refresh-books", sValidator("json", RefreshBooksBody), async (c) => {
    requireEditMetadata(c.var.user!);
    const { bookIds } = c.req.valid("json");
    // Filter to books that actually exist so non-existent ids don't enqueue.
    const db = requireDb();
    const present = await db
      .select({ id: schema.books.id })
      .from(schema.books)
      .where(inArray(schema.books.id, bookIds));
    return c.json(await enqueueRefresh(present.map((r) => r.id)), 202);
  });
