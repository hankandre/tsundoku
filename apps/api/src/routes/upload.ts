import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { bodyLimit } from "hono/body-limit";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { eq } from "drizzle-orm";
import { schema } from "@tsundoku/db";
import { sValidator } from "@hono/standard-validator";
import { authRequired } from "../middleware/auth.ts";
import { IdParam } from "../utils/schemas.ts";
import { requireDb } from "../db.ts";
import { ingestFile } from "../services/scan.ts";
import { titleFromFilename } from "../services/extractors/index.ts";

const EXT_TO_TYPE: Record<string, schema.BookType> = {
  ".pdf": "PDF",
  ".epub": "EPUB",
  ".cbz": "CBX",
  ".cbr": "CBX",
  ".mobi": "MOBI",
  ".azw3": "AZW3",
  ".fb2": "FB2",
  ".m4b": "AUDIOBOOK",
  ".mp3": "AUDIOBOOK",
};

const MAX_BYTES = 1024 * 1024 * 1024; // 1 GiB — matches Booklore's cap

export const uploadRoutes = new Hono()
  .use("*", authRequired)
  .post(
    "/libraries/:id/upload",
    sValidator("param", IdParam),
    // Guard the body BEFORE parseBody() buffers it. Without this, an attacker
    // could force the server to allocate gigabytes before our size check ran.
    bodyLimit({
      maxSize: MAX_BYTES,
      onError: (c) => c.json({ error: "File exceeds 1 GiB limit" }, 413),
    }),
    async (c) => {
    const u = c.var.user!;
    if (!u.isAdmin && !u.permissions.includes("upload")) {
      throw new HTTPException(403, { message: "Upload not permitted" });
    }
    const { id: libraryId } = c.req.valid("param");

    const db = requireDb();
    const paths = await db
      .select()
      .from(schema.libraryPaths)
      .where(eq(schema.libraryPaths.libraryId, libraryId));
    if (paths.length === 0) {
      throw new HTTPException(400, { message: "Library has no paths configured" });
    }
    const target = paths[0]!;

    const form = await c.req.parseBody().catch(() => null);
    const file = form?.["file"];
    if (!(file instanceof File)) throw new HTTPException(400, { message: "No file uploaded" });
    const ext = path.extname(file.name).toLowerCase();
    const bookType = EXT_TO_TYPE[ext];
    if (!bookType) throw new HTTPException(415, { message: `Unsupported format ${ext}` });

    // Persist to disk under the library path. Collisions get a suffix.
    let destName = file.name;
    let dest = path.join(target.path, destName);
    let suffix = 1;
    while (await exists(dest)) {
      const stem = path.basename(destName, ext);
      destName = `${stem}-${suffix}${ext}`;
      dest = path.join(target.path, destName);
      suffix++;
    }
    await fs.mkdir(target.path, { recursive: true });
    await Bun.write(dest, file);

    const inserted = await db
      .insert(schema.books)
      .values({
        libraryId,
        libraryPathId: target.id,
        fileName: destName,
        fileSubPath: null,
        bookType,
        scannedOn: new Date(),
      })
      .returning();
    const book = inserted[0]!;

    const { warning } = await ingestFile({
      bookId: book.id,
      bookType,
      absPath: dest,
      fallbackTitle: titleFromFilename(destName),
    });

    return c.json({ id: book.id, fileName: destName, warning: warning ?? null }, 201);
    },
  );

async function exists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}
