import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { sValidator } from "@hono/standard-validator";
import { type } from "arktype";
import { authRequired } from "../middleware/auth.ts";
import { IdParam, LibraryPathParam } from "../utils/schemas.ts";
import {
  listLibrariesForUser,
  createLibrary,
  deleteLibrary,
  updateLibrary,
  addLibraryPath,
  deleteLibraryPath,
  userCanAccessLibrary,
  libraryHealth,
  listBookIdsInLibrary,
} from "../services/libraries.ts";
import { enqueue } from "../services/tasks.ts";
import { ingestFile } from "../services/scan.ts";
import { resolveBookFile } from "../services/files.ts";
import { titleFromFilename } from "../services/extractors/index.ts";

const CreateLibraryBody = type({
  name: "1 <= string <= 256",
  "icon?": "string <= 128",
  "organizationMode?": "'BOOK_PER_FILE' | 'BOOK_PER_DIRECTORY' | 'AUTO_DETECT'",
  "paths?": "(string > 0)[]",
});

const UpdateLibraryBody = type({
  "name?": "1 <= string <= 256",
  "icon?": "(string <= 128) | null",
  "organizationMode?": "'BOOK_PER_FILE' | 'BOOK_PER_DIRECTORY' | 'AUTO_DETECT'",
  "sortOrder?": "number.integer",
});

const AddPathBody = type({
  path: "1 <= string <= 4096",
});

function requireLibraryManage(u: { isAdmin: boolean; permissions: string[] }) {
  if (!u.isAdmin && !u.permissions.includes("manipulateLibrary")) {
    throw new HTTPException(403, { message: "Library management not permitted" });
  }
}

export const libraryRoutes = new Hono()
  .use("*", authRequired)
  .get("/libraries", async (c) => {
    const u = c.var.user!;
    const libs = await listLibrariesForUser(u.id, u.isAdmin);
    return c.json(libs);
  })
  .get("/libraries/:id", sValidator("param", IdParam), async (c) => {
    const { id } = c.req.valid("param");
    const u = c.var.user!;
    const ok = await userCanAccessLibrary(u.id, u.isAdmin, id);
    if (!ok) throw new HTTPException(404, { message: "Library not found" });
    const libs = await listLibrariesForUser(u.id, u.isAdmin);
    const lib = libs.find((l) => l.id === id);
    if (!lib) throw new HTTPException(404, { message: "Library not found" });
    return c.json(lib);
  })
  .post("/libraries", sValidator("json", CreateLibraryBody), async (c) => {
    requireLibraryManage(c.var.user!);
    const body = c.req.valid("json");
    const lib = await createLibrary({ ...body, paths: body.paths ?? [] });
    return c.json(lib, 201);
  })
  .patch(
    "/libraries/:id",
    sValidator("param", IdParam),
    sValidator("json", UpdateLibraryBody),
    async (c) => {
      requireLibraryManage(c.var.user!);
      const { id } = c.req.valid("param");
      const lib = await updateLibrary(id, c.req.valid("json"));
      if (!lib) throw new HTTPException(404, { message: "Library not found" });
      return c.json(lib);
    },
  )
  .delete("/libraries/:id", sValidator("param", IdParam), async (c) => {
    const u = c.var.user!;
    if (!u.isAdmin) throw new HTTPException(403, { message: "Admin required" });
    const { id } = c.req.valid("param");
    await deleteLibrary(id);
    return c.json({ ok: true });
  })
  .post(
    "/libraries/:id/paths",
    sValidator("param", IdParam),
    sValidator("json", AddPathBody),
    async (c) => {
      requireLibraryManage(c.var.user!);
      const { id } = c.req.valid("param");
      const row = await addLibraryPath(id, c.req.valid("json").path);
      return c.json(row, 201);
    },
  )
  .delete(
    "/libraries/:id/paths/:pathId",
    sValidator("param", LibraryPathParam),
    async (c) => {
      requireLibraryManage(c.var.user!);
      const { id, pathId } = c.req.valid("param");
      const removed = await deleteLibraryPath(id, pathId);
      if (!removed) throw new HTTPException(404, { message: "Path not found" });
      return c.json({ ok: true });
    },
  )
  // Re-ingest a single book file (re-runs extractor + cover save) without
  // walking the library. Useful when a file was replaced on disk.
  .post(
    "/libraries/:id/rescan-book/:pathId",
    sValidator("param", LibraryPathParam),
    async (c) => {
      requireLibraryManage(c.var.user!);
      // We route as /:id/rescan-book/:bookId — `pathId` here is the bookId
      // (LibraryPathParam happens to be {id, pathId} which fits without a new
      // schema, but the second slug is the book).
      const { pathId: bookId } = c.req.valid("param");
      const resolved = await resolveBookFile(bookId);
      if (!resolved) throw new HTTPException(404, { message: "Book not found" });
      const result = await ingestFile({
        bookId,
        bookType: resolved.bookType,
        absPath: resolved.absolutePath,
        fallbackTitle: titleFromFilename(resolved.filename),
      });
      return c.json(result);
    },
  )
  // Re-extract covers for every book in the library by re-issuing
  // metadata-refresh jobs. Slower than a scan but works on existing rows.
  .post("/libraries/:id/recreate-covers", sValidator("param", IdParam), async (c) => {
    requireLibraryManage(c.var.user!);
    const { id } = c.req.valid("param");
    const ids = await listBookIdsInLibrary(id);
    const taskIds = await Promise.all(
      ids.map((bookId) =>
        enqueue(
          "metadata-refresh",
          { bookId },
          { jobId: `refresh-${bookId}` },
        ).catch(() => `refresh-${bookId}`),
      ),
    );
    return c.json({ enqueued: taskIds.length }, 202);
  })
  // Same shape as recreate-covers; semantically distinct so logs/UI can tell
  // them apart. Falls into the same queue today; could split if we add a
  // "tags-only" refresh later.
  .post("/libraries/:id/retag-all", sValidator("param", IdParam), async (c) => {
    requireLibraryManage(c.var.user!);
    const { id } = c.req.valid("param");
    const ids = await listBookIdsInLibrary(id);
    const taskIds = await Promise.all(
      ids.map((bookId) =>
        enqueue(
          "metadata-refresh",
          { bookId },
          { jobId: `refresh-${bookId}` },
        ).catch(() => `refresh-${bookId}`),
      ),
    );
    return c.json({ enqueued: taskIds.length }, 202);
  })
  .get("/libraries/:id/health", sValidator("param", IdParam), async (c) => {
    const u = c.var.user!;
    const { id } = c.req.valid("param");
    const ok = await userCanAccessLibrary(u.id, u.isAdmin, id);
    if (!ok) throw new HTTPException(404, { message: "Library not found" });
    return c.json(await libraryHealth(id));
  });
