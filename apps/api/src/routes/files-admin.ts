import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { sValidator } from "@hono/standard-validator";
import { type } from "arktype";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { eq } from "drizzle-orm";
import { schema } from "@tsundoku/db";
import { requireDb } from "../db.ts";
import { authRequired } from "../middleware/auth.ts";
import { IdParam } from "../utils/schemas.ts";
import { resolveBookFile } from "../services/files.ts";
import { logger } from "../logger.ts";

/**
 * File rename + move endpoints for book files. Constrained to library-managed
 * paths — we don't expose generic FS access.
 *
 *   PUT /books/:id/rename   — change file name in place
 *   PUT /books/:id/move     — move to a different library path within same library
 */

// File names must be a single segment — reject anything containing path
// separators so callers can't escape the library directory.
const RenameBody = type({
  newName: type("1 <= string <= 512").narrow((v, ctx) =>
    /^[^/\\]+$/.test(v) || ctx.mustBe("a file name without path separators"),
  ),
});

const MoveBody = type({
  libraryPathId: "string.uuid",
});

function requireManage(u: { isAdmin: boolean; permissions: string[] }) {
  if (!u.isAdmin && !u.permissions.includes("manipulateLibrary")) {
    throw new HTTPException(403, { message: "File ops not permitted" });
  }
}

export const filesAdminRoutes = new Hono()
  .use("*", authRequired)
  .put(
    "/books/:id/rename",
    sValidator("param", IdParam),
    sValidator("json", RenameBody),
    async (c) => {
      requireManage(c.var.user!);
      const { id } = c.req.valid("param");
      const { newName } = c.req.valid("json");
      const resolved = await resolveBookFile(id);
      if (!resolved) throw new HTTPException(404, { message: "Book not found" });
      const dir = path.dirname(resolved.absolutePath);
      const dest = path.join(dir, newName);
      if (await pathExists(dest))
        throw new HTTPException(409, { message: "A file with that name already exists" });
      await fs.rename(resolved.absolutePath, dest);
      const db = requireDb();
      await db
        .update(schema.books)
        .set({ fileName: newName })
        .where(eq(schema.books.id, id));
      logger.info({ id, newName }, "book renamed");
      return c.json({ ok: true, fileName: newName });
    },
  )
  .put(
    "/books/:id/move",
    sValidator("param", IdParam),
    sValidator("json", MoveBody),
    async (c) => {
      requireManage(c.var.user!);
      const { id } = c.req.valid("param");
      const { libraryPathId } = c.req.valid("json");
      const resolved = await resolveBookFile(id);
      if (!resolved) throw new HTTPException(404, { message: "Book not found" });

      const db = requireDb();
      const pathRows = await db
        .select()
        .from(schema.libraryPaths)
        .where(eq(schema.libraryPaths.id, libraryPathId))
        .limit(1);
      const target = pathRows[0];
      if (!target) throw new HTTPException(400, { message: "Target path not found" });

      const bookRows = await db
        .select()
        .from(schema.books)
        .where(eq(schema.books.id, id))
        .limit(1);
      const book = bookRows[0];
      if (!book) throw new HTTPException(404, { message: "Book row missing" });
      if (book.libraryId !== target.libraryId)
        throw new HTTPException(400, {
          message: "Cannot move across libraries",
        });

      await fs.mkdir(target.path, { recursive: true });
      const dest = path.join(target.path, book.fileName);
      if (await pathExists(dest))
        throw new HTTPException(409, {
          message: "Destination already has a file with that name",
        });
      await fs.rename(resolved.absolutePath, dest).catch(async () => {
        // EXDEV — cross-device rename. Copy + unlink.
        await fs.copyFile(resolved.absolutePath, dest);
        await fs.unlink(resolved.absolutePath);
      });
      await db
        .update(schema.books)
        .set({ libraryPathId: target.id, fileSubPath: null })
        .where(eq(schema.books.id, id));
      logger.info({ id, dest }, "book moved");
      return c.json({ ok: true });
    },
  );

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}
