import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { sValidator } from "@hono/standard-validator";
import { type } from "arktype";
import { authOptional, authRequired } from "../middleware/auth.ts";
import { IdParam } from "../utils/schemas.ts";
import { isUuid } from "../utils/id.ts";
import { listBooks, getBookDetail } from "../services/books.ts";
import { findCover } from "../services/covers.ts";
import { resolveBookFile, statFile } from "../services/files.ts";
import { verifyToken } from "../services/tokens.ts";
import {
  getBookFileMetadata,
  setReadStatus,
  resetProgressForBooks,
  setRating,
  resetRatingForBooks,
  findRecommendations,
  findDuplicates,
  getBatch,
} from "../services/book-ops.ts";

// Query-string numbers arrive as strings; arktype's `string.integer.parse`
// morph converts them, then `.to(...)` constrains the parsed number.
const PageNum = type("string.integer.parse").to("number >= 0");
const SizeNum = type("string.integer.parse").to("1 <= number <= 100");

const BookQueryParams = type({
  "libraryId?": "string.uuid",
  "shelfId?": "string.uuid",
  "magicShelfId?": "string.uuid",
  "search?": "string",
  "bookType?": "'PDF' | 'EPUB' | 'CBX' | 'MOBI' | 'AZW3' | 'FB2' | 'AUDIOBOOK'",
  "sort?": "'addedOn' | 'title' | 'rating' | 'pageCount'",
  "direction?": "'asc' | 'desc'",
  "page?": PageNum,
  "size?": SizeNum,
});

const BatchQuery = type({
  ids: "string", // comma-separated UUIDs; split + filtered in handler
});

const StatusBody = type({
  updates: type({
    bookId: "string.uuid",
    status: "'READING' | 'FINISHED' | 'UNREAD'",
  }).array().atLeastLength(1),
});

const ResetProgressBody = type({
  bookIds: type("string.uuid").array().atLeastLength(1),
});

const RatingBody = type({
  bookId: "string.uuid",
  rating: "(0 <= number <= 5) | null",
});

const ResetRatingBody = type({
  bookIds: type("string.uuid").array().atLeastLength(1),
});

async function userFromQueryToken(token: string | undefined) {
  if (!token) return null;
  try {
    const claims = await verifyToken(token);
    return { id: String(claims.sub ?? ""), isAdmin: Boolean(claims.isAdmin) };
  } catch {
    return null;
  }
}

const COVER_ROUTES = new Hono()
  // Cover endpoint allows ?token= for <img> tags. Mounted under /books/:id
  // before the auth-required group so the bearer header is optional.
  .use("*", authOptional)
  .get("/books/:id/cover", sValidator("param", IdParam), async (c) => {
    const { id } = c.req.valid("param");
    const user = c.var.user
      ? { id: c.var.user.id, isAdmin: c.var.user.isAdmin }
      : await userFromQueryToken(c.req.query("token"));
    if (!user) throw new HTTPException(401, { message: "Authentication required" });

    const cover = await findCover(id);
    if (!cover) return c.body(null, 404);
    const file = Bun.file(cover.path);
    return new Response(file.stream(), {
      headers: {
        "Content-Type": cover.contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  })
  // Download tolerates a query-string token so a plain <a download> link
  // works without JS attaching headers.
  .get("/books/:id/download", sValidator("param", IdParam), async (c) => {
    const { id } = c.req.valid("param");
    const user = c.var.user
      ? { id: c.var.user.id, isAdmin: c.var.user.isAdmin }
      : await userFromQueryToken(c.req.query("token"));
    if (!user) throw new HTTPException(401, { message: "Authentication required" });
    const resolved = await resolveBookFile(id);
    if (!resolved) throw new HTTPException(404, { message: "Book not found" });
    const stat = await statFile(resolved.absolutePath);
    if (!stat) throw new HTTPException(404, { message: "File missing on disk" });
    const file = Bun.file(resolved.absolutePath);
    const safeName = encodeURIComponent(resolved.filename);
    return new Response(file.stream(), {
      headers: {
        "Content-Type": resolved.contentType,
        "Content-Length": String(stat.size),
        "Content-Disposition": `attachment; filename*=UTF-8''${safeName}`,
      },
    });
  });

const READ_ROUTES = new Hono()
  .use("*", authRequired)
  .get("/books", sValidator("query", BookQueryParams), async (c) => {
    const u = c.var.user!;
    const q = c.req.valid("query");
    const result = await listBooks(u.id, u.isAdmin, q);
    return c.json(result);
  })
  .get("/books/batch", sValidator("query", BatchQuery), async (c) => {
    const ids = c.req
      .valid("query")
      .ids.split(",")
      .map((s) => s.trim())
      .filter(isUuid);
    return c.json(await getBatch(ids));
  })
  .get("/books/duplicates", async (c) => c.json(await findDuplicates()))
  .get("/books/:id", sValidator("param", IdParam), async (c) => {
    const u = c.var.user!;
    const { id } = c.req.valid("param");
    const book = await getBookDetail(u.id, u.isAdmin, id);
    if (!book) throw new HTTPException(404, { message: "Book not found" });
    return c.json(book);
  })
  .get("/books/:id/file-metadata", sValidator("param", IdParam), async (c) => {
    const { id } = c.req.valid("param");
    const md = await getBookFileMetadata(id);
    if (!md) throw new HTTPException(404, { message: "File missing" });
    return c.json(md);
  })
  .get("/books/:id/recommendations", sValidator("param", IdParam), async (c) => {
    const { id } = c.req.valid("param");
    const recIds = await findRecommendations(id);
    if (recIds.length === 0) return c.json([]);
    return c.json(await getBatch(recIds));
  })

  .post("/books/status", sValidator("json", StatusBody), async (c) => {
    const u = c.var.user!;
    await setReadStatus(u.id, c.req.valid("json").updates);
    return c.json({ ok: true });
  })
  .post("/books/reset-progress", sValidator("json", ResetProgressBody), async (c) => {
    const u = c.var.user!;
    await resetProgressForBooks(u.id, c.req.valid("json").bookIds);
    return c.json({ ok: true });
  })
  .put("/books/personal-rating", sValidator("json", RatingBody), async (c) => {
    const u = c.var.user!;
    if (!u.isAdmin && !u.permissions.includes("editMetadata")) {
      throw new HTTPException(403, { message: "Rating not permitted" });
    }
    const { bookId, rating } = c.req.valid("json");
    await setRating(bookId, rating);
    return c.json({ ok: true });
  })
  .post(
    "/books/reset-personal-rating",
    sValidator("json", ResetRatingBody),
    async (c) => {
      const u = c.var.user!;
      if (!u.isAdmin && !u.permissions.includes("editMetadata")) {
        throw new HTTPException(403, { message: "Rating reset not permitted" });
      }
      await resetRatingForBooks(c.req.valid("json").bookIds);
      return c.json({ ok: true });
    },
  );

export const bookRoutes = new Hono().route("/", COVER_ROUTES).route("/", READ_ROUTES);
