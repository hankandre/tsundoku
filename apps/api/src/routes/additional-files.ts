import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { bodyLimit } from "hono/body-limit";
import { sValidator } from "@hono/standard-validator";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { and, eq } from "drizzle-orm";
import { schema } from "@tsundoku/db";
import { requireDb } from "../db.ts";
import { authRequired } from "../middleware/auth.ts";
import { IdParam } from "../utils/schemas.ts";
import { resolveBookFile } from "../services/files.ts";

/**
 * Per-book additional / companion files (samples, soundtracks, sub-volumes).
 * Stored next to the primary file in the book's directory, registered as
 * rows on `book_additional_files`. Streamed back through this endpoint so
 * permissions stay centralized.
 */

const MAX_BYTES = 512 * 1024 * 1024; // 512 MiB
const PERMISSION_COLUMNS = {
  upload: schema.userPermissions.upload,
  manipulateLibrary: schema.userPermissions.manipulateLibrary,
} as const;

const FileIdParam = sValidator(
  "param",
  // Reuse IdParam by name reads as confusing here; alias for clarity.
  IdParam,
);

async function hasPermission(
  user: { id: string; isAdmin: boolean; permissions: string[] },
  permission: keyof typeof PERMISSION_COLUMNS,
): Promise<boolean> {
  if (user.isAdmin || user.permissions.includes(permission)) return true;

  const db = requireDb();
  const rows = await db
    .select({ allowed: PERMISSION_COLUMNS[permission] })
    .from(schema.userPermissions)
    .where(eq(schema.userPermissions.userId, user.id))
    .limit(1);
  return Boolean(rows[0]?.allowed);
}

export const additionalFileRoutes = new Hono()
  .use("*", authRequired)
  .get("/books/:id/files", sValidator("param", IdParam), async (c) => {
    const { id } = c.req.valid("param");
    const db = requireDb();
    return c.json(
      await db
        .select()
        .from(schema.bookAdditionalFiles)
        .where(eq(schema.bookAdditionalFiles.bookId, id)),
    );
  })
  .post(
    "/books/:id/files",
    sValidator("param", IdParam),
    bodyLimit({
      maxSize: MAX_BYTES,
      onError: (c) => c.json({ error: "File exceeds 512 MiB limit" }, 413),
    }),
    async (c) => {
      const u = c.var.user!;
      if (!(await hasPermission(u, "upload"))) {
        throw new HTTPException(403, { message: "Upload not permitted" });
      }
      const { id } = c.req.valid("param");
      const resolved = await resolveBookFile(id);
      if (!resolved) throw new HTTPException(404, { message: "Book not found" });

      const form = await c.req.parseBody().catch(() => null);
      const file = form?.["file"];
      const label = String(form?.["label"] ?? "").trim() || null;
      if (!(file instanceof File))
        throw new HTTPException(400, { message: "No file uploaded" });

      const dir = path.join(path.dirname(resolved.absolutePath), `.additional-${id}`);
      await fs.mkdir(dir, { recursive: true });
      const safeName = path.basename(file.name);
      const dest = path.join(dir, safeName);
      await Bun.write(dest, file);

      const db = requireDb();
      const inserted = await db
        .insert(schema.bookAdditionalFiles)
        .values({
          bookId: id,
          label: label ?? safeName,
          fileName: safeName,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
        })
        .returning();
      return c.json(inserted[0], 201);
    },
  )
  .get(
    "/books/:id/files/:fileId/download",
    sValidator("param", IdParam),
    async (c) => {
      const { id } = c.req.valid("param");
      const fileId = c.req.param("fileId");
      if (!fileId) throw new HTTPException(400, { message: "Bad fileId" });
      const db = requireDb();
      const rows = await db
        .select()
        .from(schema.bookAdditionalFiles)
        .where(
          and(
            eq(schema.bookAdditionalFiles.id, fileId),
            eq(schema.bookAdditionalFiles.bookId, id),
          ),
        )
        .limit(1);
      const af = rows[0];
      if (!af) throw new HTTPException(404, { message: "File not found" });
      const resolved = await resolveBookFile(id);
      if (!resolved) throw new HTTPException(404, { message: "Book not found" });
      const dir = path.join(path.dirname(resolved.absolutePath), `.additional-${id}`);
      const abs = path.join(dir, af.fileName);
      const bunFile = Bun.file(abs);
      if (!(await bunFile.exists()))
        throw new HTTPException(404, { message: "File missing on disk" });
      return new Response(bunFile.stream(), {
        headers: {
          "Content-Type": af.mimeType,
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(af.fileName)}`,
        },
      });
    },
  )
  .delete(
    "/books/:id/files/:fileId",
    sValidator("param", IdParam),
    async (c) => {
      const u = c.var.user!;
      if (!(await hasPermission(u, "manipulateLibrary"))) {
        throw new HTTPException(403, { message: "Delete not permitted" });
      }
      const { id } = c.req.valid("param");
      const fileId = c.req.param("fileId");
      if (!fileId) throw new HTTPException(400, { message: "Bad fileId" });
      const db = requireDb();
      const rows = await db
        .select()
        .from(schema.bookAdditionalFiles)
        .where(
          and(
            eq(schema.bookAdditionalFiles.id, fileId),
            eq(schema.bookAdditionalFiles.bookId, id),
          ),
        )
        .limit(1);
      const af = rows[0];
      if (!af) throw new HTTPException(404, { message: "File not found" });
      const resolved = await resolveBookFile(id);
      if (resolved) {
        const dir = path.join(path.dirname(resolved.absolutePath), `.additional-${id}`);
        const abs = path.join(dir, af.fileName);
        await fs.unlink(abs).catch(() => undefined);
      }
      await db
        .delete(schema.bookAdditionalFiles)
        .where(eq(schema.bookAdditionalFiles.id, fileId));
      return c.json({ ok: true });
    },
  );

// Force the linter to see FileIdParam as used (we keep it for future routes
// that disambiguate (:id, :fileId) once we add a dedicated AdditionalFileParam).
void FileIdParam;
