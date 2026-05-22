import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { sValidator } from "@hono/standard-validator";
import { type } from "arktype";
import { authRequired } from "../middleware/auth.ts";
import { IdParam } from "../utils/schemas.ts";
import {
  listAuthors,
  getAuthor,
  getBooksByAuthor,
  updateAuthor,
  mergeAuthors,
} from "../services/authors.ts";
import { schema } from "@tsundoku/db";
import { requireDb } from "../db.ts";
import { eq } from "drizzle-orm";

async function allowedLibraries(userId: string, isAdmin: boolean): Promise<string[] | "all"> {
  if (isAdmin) return "all";
  const db = requireDb();
  const rows = await db
    .select({ libraryId: schema.userLibraryMapping.libraryId })
    .from(schema.userLibraryMapping)
    .where(eq(schema.userLibraryMapping.userId, userId));
  return rows.map((r) => r.libraryId);
}

const UpdateAuthorBody = type({
  "name?": "1 <= string <= 512",
  "bio?": "string | null",
  "imageUrl?": "string.url | null",
});

const MergeBody = type({
  sourceId: "string.uuid",
  targetId: "string.uuid",
});

const PhotoBody = type({ url: "string.url" });

function requireEditMetadata(u: { isAdmin: boolean; permissions: string[] }) {
  if (!u.isAdmin && !u.permissions.includes("editMetadata")) {
    throw new HTTPException(403, { message: "Author edit not permitted" });
  }
}

export const authorRoutes = new Hono()
  .use("*", authRequired)
  .get("/authors", async (c) => {
    return c.json(await listAuthors());
  })
  .get("/authors/:id", sValidator("param", IdParam), async (c) => {
    const u = c.var.user!;
    const { id } = c.req.valid("param");
    const author = await getAuthor(id);
    if (!author) throw new HTTPException(404, { message: "Author not found" });
    const allowed = await allowedLibraries(u.id, u.isAdmin);
    const books = await getBooksByAuthor(id, allowed);
    return c.json({ ...author, books });
  })
  .patch(
    "/authors/:id",
    sValidator("param", IdParam),
    sValidator("json", UpdateAuthorBody),
    async (c) => {
      requireEditMetadata(c.var.user!);
      const { id } = c.req.valid("param");
      await updateAuthor(id, c.req.valid("json"));
      return c.json({ ok: true });
    },
  )
  // Fetch an image from a URL and set it as the author's portrait. Image
  // bytes are stored locally to avoid hotlinking and to outlast the source.
  .post(
    "/authors/:id/photo",
    sValidator("param", IdParam),
    sValidator("json", PhotoBody),
    async (c) => {
      requireEditMetadata(c.var.user!);
      const { id } = c.req.valid("param");
      const { url } = c.req.valid("json");
      const res = await fetch(url);
      if (!res.ok)
        throw new HTTPException(502, { message: `Upstream returned ${res.status}` });
      // Store on disk and reference the local path so we don't leak the source.
      const fs = await import("node:fs/promises");
      const nodePath = await import("node:path");
      const dir = `${process.env.HOME ?? "."}/.tsundoku/author-photos`;
      await fs.mkdir(dir, { recursive: true });
      const ext =
        res.headers.get("Content-Type") === "image/png" ? ".png" : ".jpg";
      const file = nodePath.join(dir, `${id}${ext}`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      await Bun.write(file, bytes);
      // Image is served via the API at /authors/:id/photo (a GET handler
      // streams from disk). The DB column stores the path so server moves
      // don't break URLs.
      await updateAuthor(id, { imageUrl: `/api/v1/authors/${id}/photo` });
      return c.json({ ok: true });
    },
  )
  // Stream the locally stored author photo if present.
  .get("/authors/:id/photo", sValidator("param", IdParam), async (c) => {
    const { id } = c.req.valid("param");
    const nodePath = await import("node:path");
    const dir = `${process.env.HOME ?? "."}/.tsundoku/author-photos`;
    for (const ext of [".png", ".jpg"]) {
      const p = nodePath.join(dir, `${id}${ext}`);
      const f = Bun.file(p);
      if (await f.exists()) {
        return new Response(f.stream(), {
          headers: {
            "Content-Type": ext === ".png" ? "image/png" : "image/jpeg",
            "Cache-Control": "private, max-age=3600",
          },
        });
      }
    }
    throw new HTTPException(404, { message: "No photo" });
  })
  // Merge two authors (target absorbs the source).
  .post("/authors/merge", sValidator("json", MergeBody), async (c) => {
    requireEditMetadata(c.var.user!);
    const { sourceId, targetId } = c.req.valid("json");
    await mergeAuthors(sourceId, targetId);
    return c.json({ ok: true });
  });
