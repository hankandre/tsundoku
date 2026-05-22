import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { sValidator } from "@hono/standard-validator";
import { type } from "arktype";
import { authRequired } from "../middleware/auth.ts";
import { IdParam, NoteIdParam, BookmarkIdParam } from "../utils/schemas.ts";
import { updateBookMetadata } from "../services/metadata.ts";
import { listProviders, searchAll } from "../services/providers/index.ts";
import { searchForBook, applyMatch, autoRefresh, setLock } from "../services/metadata-refresh.ts";
import {
  listNotes,
  createNote,
  updateNote,
  deleteNote,
  listBookmarks,
  createBookmark,
  deleteBookmark,
} from "../services/notes.ts";
import {
  getProgress,
  setProgress,
  startSession,
  endSession,
  listSessions,
} from "../services/progress.ts";

// Arktype is strict by default — excess keys are rejected without a modifier.
const MetadataPatch = type({
  "title?": "string | null",
  "subtitle?": "string | null",
  "description?": "string | null",
  "publisher?": "string | null",
  "publishedDate?": "string | null",
  "isbn10?": "string | null",
  "isbn13?": "string | null",
  "asin?": "string | null",
  "pageCount?": "number.integer | null",
  "language?": "string | null",
  "rating?": "number | null",
  "ageRating?": "string | null",
  "seriesName?": "string | null",
  "seriesNumber?": "number | null",
  "authors?": "string[]",
  "categories?": "string[]",
  "titleLocked?": "boolean",
  "descriptionLocked?": "boolean",
  "authorsLocked?": "boolean",
});

// Arktype validators — these flow through @hono/standard-validator the same
// as zod ones because both implement Standard Schema v1. The shorthand is
// "field?": "type | null" for "optional nullable".
const NoteBody = type({
  "cfi?": "string | null",
  "selectedText?": "string | null",
  "noteContent?": "string | null",
  "color?": "string | null",
  "chapterTitle?": "string | null",
});

const BookmarkBody = type({
  location: "string > 0",
  "label?": "string | null",
});

const ProgressBody = type({
  "pdfProgress?": "number.integer | null",
  "epubProgress?": "string | null",
  "audiobookProgressSeconds?": "number.integer | null",
  "finished?": "boolean",
});

const SessionEndBody = type({
  sessionId: "string.uuid",
  "endLocation?": "string | null",
});

const SessionStartBody = type({
  "startLocation?": "string | null",
});

const ProviderSearchLimit = type("string.integer.parse").to("1 <= number <= 40");

const ProviderSearchQuery = type({
  "title?": "string",
  "authors?": "string",
  "isbn?": "string",
  "limit?": ProviderSearchLimit,
});

const ApplyMatchBody = type({
  match: "Record<string, unknown>",
  "applyCover?": "boolean",
});

const LockBody = type({
  field:
    "'title' | 'subtitle' | 'description' | 'publisher' | 'publishedDate' | 'isbn' | 'pageCount' | 'language' | 'rating' | 'ageRating' | 'cover' | 'authors' | 'categories'",
  locked: "boolean",
});

function requireEditMetadata(u: { isAdmin: boolean; permissions: string[] }) {
  if (!u.isAdmin && !u.permissions.includes("editMetadata")) {
    throw new HTTPException(403, { message: "Metadata editing not permitted" });
  }
}

export const metadataRoutes = new Hono()
  .use("*", authRequired)
  .get("/metadata/providers", async (c) => {
    return c.json(listProviders().map((p) => ({ id: p.id, name: p.name })));
  })
  .get("/metadata/search", sValidator("query", ProviderSearchQuery), async (c) => {
    const q = c.req.valid("query");
    const authors = q.authors?.split(",").map((a) => a.trim()).filter(Boolean);
    const result = await searchAll({
      title: q.title,
      authors,
      isbn: q.isbn,
      limit: q.limit,
    });
    return c.json(result);
  })
  .put(
    "/books/:id/metadata",
    sValidator("param", IdParam),
    sValidator("json", MetadataPatch),
    async (c) => {
      requireEditMetadata(c.var.user!);
      const { id } = c.req.valid("param");
      await updateBookMetadata(id, c.req.valid("json"));
      return c.json({ ok: true });
    },
  )
  // Search providers using the book's existing title+ISBN; the client picks
  // which match to apply via POST /books/:id/metadata/apply.
  .get("/books/:id/metadata/search", sValidator("param", IdParam), async (c) => {
    const { id } = c.req.valid("param");
    return c.json(await searchForBook(id));
  })
  // Apply a provider match (typically chosen from /search above). Respects
  // per-field locks in book_metadata.
  .post(
    "/books/:id/metadata/apply",
    sValidator("param", IdParam),
    sValidator("json", ApplyMatchBody),
    async (c) => {
      requireEditMetadata(c.var.user!);
      const { id } = c.req.valid("param");
      const { match, applyCover } = c.req.valid("json");
      await applyMatch(id, match as Parameters<typeof applyMatch>[1], {
        applyCover: applyCover ?? true,
      });
      return c.json({ ok: true });
    },
  )
  // One-call refresh: search + apply best match.
  .post("/books/:id/metadata/refresh", sValidator("param", IdParam), async (c) => {
    requireEditMetadata(c.var.user!);
    const { id } = c.req.valid("param");
    const result = await autoRefresh(id);
    return c.json(result);
  })
  // Per-field lock toggle.
  .put(
    "/books/:id/metadata/lock",
    sValidator("param", IdParam),
    sValidator("json", LockBody),
    async (c) => {
      requireEditMetadata(c.var.user!);
      const { id } = c.req.valid("param");
      const { field, locked } = c.req.valid("json");
      await setLock(id, field, locked);
      return c.json({ ok: true });
    },
  )

  .get("/books/:id/notes", sValidator("param", IdParam), async (c) => {
    const u = c.var.user!;
    const { id } = c.req.valid("param");
    return c.json(await listNotes(u.id, id));
  })
  .post(
    "/books/:id/notes",
    sValidator("param", IdParam),
    sValidator("json", NoteBody),
    async (c) => {
      const u = c.var.user!;
      const { id } = c.req.valid("param");
      const created = await createNote(u.id, id, c.req.valid("json"));
      return c.json(created, 201);
    },
  )
  .put(
    "/notes/:noteId",
    sValidator("param", NoteIdParam),
    sValidator("json", NoteBody),
    async (c) => {
      const u = c.var.user!;
      const { noteId } = c.req.valid("param");
      await updateNote(u.id, noteId, c.req.valid("json"));
      return c.json({ ok: true });
    },
  )
  .delete("/notes/:noteId", sValidator("param", NoteIdParam), async (c) => {
    const u = c.var.user!;
    const { noteId } = c.req.valid("param");
    await deleteNote(u.id, noteId);
    return c.json({ ok: true });
  })

  .get("/books/:id/bookmarks", sValidator("param", IdParam), async (c) => {
    const u = c.var.user!;
    const { id } = c.req.valid("param");
    return c.json(await listBookmarks(u.id, id));
  })
  .post(
    "/books/:id/bookmarks",
    sValidator("param", IdParam),
    sValidator("json", BookmarkBody),
    async (c) => {
      const u = c.var.user!;
      const { id } = c.req.valid("param");
      const created = await createBookmark({ userId: u.id, bookId: id, ...c.req.valid("json") });
      return c.json(created, 201);
    },
  )
  .delete("/bookmarks/:bookmarkId", sValidator("param", BookmarkIdParam), async (c) => {
    const u = c.var.user!;
    const { bookmarkId } = c.req.valid("param");
    await deleteBookmark(u.id, bookmarkId);
    return c.json({ ok: true });
  })

  .get("/books/:id/progress", sValidator("param", IdParam), async (c) => {
    const u = c.var.user!;
    const { id } = c.req.valid("param");
    return c.json((await getProgress(u.id, id)) ?? null);
  })
  .put(
    "/books/:id/progress",
    sValidator("param", IdParam),
    sValidator("json", ProgressBody),
    async (c) => {
      const u = c.var.user!;
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      await setProgress({
        userId: u.id,
        bookId: id,
        pdfProgress: body.pdfProgress ?? null,
        epubProgress: body.epubProgress ?? null,
        audiobookProgressSeconds: body.audiobookProgressSeconds ?? null,
        finishedAt: body.finished ? new Date() : null,
      });
      return c.json({ ok: true });
    },
  )

  .get("/books/:id/sessions", sValidator("param", IdParam), async (c) => {
    const u = c.var.user!;
    const { id } = c.req.valid("param");
    return c.json(await listSessions(u.id, id));
  })
  .post(
    "/books/:id/sessions/start",
    sValidator("param", IdParam),
    sValidator("json", SessionStartBody),
    async (c) => {
      const u = c.var.user!;
      const { id } = c.req.valid("param");
      const sessionId = await startSession({
        userId: u.id,
        bookId: id,
        startLocation: c.req.valid("json").startLocation ?? null,
      });
      return c.json({ sessionId });
    },
  )
  .post(
    "/books/:id/sessions/end",
    sValidator("param", IdParam),
    sValidator("json", SessionEndBody),
    async (c) => {
      const u = c.var.user!;
      const body = c.req.valid("json");
      await endSession({ userId: u.id, sessionId: body.sessionId, endLocation: body.endLocation });
      return c.json({ ok: true });
    },
  );
