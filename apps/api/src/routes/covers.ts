import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { sValidator } from "@hono/standard-validator";
import { type } from "arktype";
import { eq } from "drizzle-orm";
import { schema } from "@tsundoku/db";
import { requireDb } from "../db.ts";
import { authRequired } from "../middleware/auth.ts";
import { IdParam } from "../utils/schemas.ts";
import { saveCover, deleteCover } from "../services/covers.ts";
import { resolveBookFile } from "../services/files.ts";
import { extractForType } from "../services/extractors/index.ts";
import { searchAll } from "../services/providers/index.ts";

const FromUrlBody = type({
  url: "string.url",
});

function requireEditMetadata(u: { isAdmin: boolean; permissions: string[] }) {
  if (!u.isAdmin && !u.permissions.includes("editMetadata")) {
    throw new HTTPException(403, { message: "Cover management not permitted" });
  }
}

async function setCoverLock(bookId: string, locked: boolean) {
  const db = requireDb();
  const existing = await db
    .select({ bookId: schema.bookMetadata.bookId })
    .from(schema.bookMetadata)
    .where(eq(schema.bookMetadata.bookId, bookId))
    .limit(1);
  if (existing.length === 0) {
    await db.insert(schema.bookMetadata).values({ bookId, coverLocked: locked });
  } else {
    await db
      .update(schema.bookMetadata)
      .set({ coverLocked: locked })
      .where(eq(schema.bookMetadata.bookId, bookId));
  }
}

export const coverAdminRoutes = new Hono()
  .use("*", authRequired)
  // Replace cover by uploading raw image bytes (multipart).
  .put("/books/:id/cover", sValidator("param", IdParam), async (c) => {
    requireEditMetadata(c.var.user!);
    const { id } = c.req.valid("param");
    const form = await c.req.parseBody().catch(() => null);
    const file = form?.["file"];
    if (!(file instanceof File))
      throw new HTTPException(400, { message: "Missing 'file' multipart field" });
    if (!file.type.startsWith("image/"))
      throw new HTTPException(415, { message: "Cover must be an image" });
    const bytes = new Uint8Array(await file.arrayBuffer());
    await saveCover(id, bytes, file.type);
    return c.json({ ok: true });
  })
  // Fetch from a URL and save.
  .post(
    "/books/:id/cover/from-url",
    sValidator("param", IdParam),
    sValidator("json", FromUrlBody),
    async (c) => {
      requireEditMetadata(c.var.user!);
      const { id } = c.req.valid("param");
      const { url } = c.req.valid("json");
      const res = await fetch(url);
      if (!res.ok)
        throw new HTTPException(502, { message: `Upstream returned ${res.status}` });
      const contentType = res.headers.get("Content-Type") ?? "image/jpeg";
      if (!contentType.startsWith("image/"))
        throw new HTTPException(415, { message: `URL is not an image (${contentType})` });
      const bytes = new Uint8Array(await res.arrayBuffer());
      await saveCover(id, bytes, contentType);
      return c.json({ ok: true });
    },
  )
  // Regenerate from the embedded cover in the book file.
  .post("/books/:id/cover/regenerate", sValidator("param", IdParam), async (c) => {
    requireEditMetadata(c.var.user!);
    const { id } = c.req.valid("param");
    const resolved = await resolveBookFile(id);
    if (!resolved) throw new HTTPException(404, { message: "Book not found" });
    const extracted = await extractForType(resolved.bookType, resolved.absolutePath);
    if (!extracted.cover)
      throw new HTTPException(404, { message: "No embedded cover found" });
    await saveCover(id, extracted.cover.bytes, extracted.cover.contentType);
    return c.json({ ok: true });
  })
  // Search providers for cover candidates. Returns coverUrl entries; the UI
  // can preview then POST /cover/from-url to apply.
  .get("/books/:id/cover/search", sValidator("param", IdParam), async (c) => {
    const { id } = c.req.valid("param");
    const db = requireDb();
    const rows = await db
      .select({
        title: schema.bookMetadata.title,
        isbn13: schema.bookMetadata.isbn13,
        isbn10: schema.bookMetadata.isbn10,
      })
      .from(schema.bookMetadata)
      .where(eq(schema.bookMetadata.bookId, id))
      .limit(1);
    const meta = rows[0];
    if (!meta) throw new HTTPException(404, { message: "Book not found" });
    const { matches } = await searchAll({
      title: meta.title ?? undefined,
      isbn: meta.isbn13 ?? meta.isbn10 ?? undefined,
      limit: 10,
    });
    return c.json(
      matches
        .filter((m) => !!m.coverUrl)
        .map((m) => ({
          providerId: m.providerId,
          externalId: m.externalId,
          title: m.title,
          coverUrl: m.coverUrl,
        })),
    );
  })
  // Toggle the cover_locked flag — locked covers aren't replaced by automatic
  // metadata refreshes.
  .post("/books/:id/cover/lock", sValidator("param", IdParam), async (c) => {
    requireEditMetadata(c.var.user!);
    const { id } = c.req.valid("param");
    await setCoverLock(id, true);
    return c.json({ ok: true });
  })
  .post("/books/:id/cover/unlock", sValidator("param", IdParam), async (c) => {
    requireEditMetadata(c.var.user!);
    const { id } = c.req.valid("param");
    await setCoverLock(id, false);
    return c.json({ ok: true });
  })
  .delete("/books/:id/cover", sValidator("param", IdParam), async (c) => {
    requireEditMetadata(c.var.user!);
    const { id } = c.req.valid("param");
    await deleteCover(id);
    return c.json({ ok: true });
  });
