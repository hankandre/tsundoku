import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { sValidator } from "@hono/standard-validator";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { eq } from "drizzle-orm";
import { schema } from "@tsundoku/db";
import { requireDb } from "../db.ts";
import { authRequired, adminRequired } from "../middleware/auth.ts";
import { IdParam } from "../utils/schemas.ts";

const ICON_DIR = `${process.env.HOME ?? "."}/.tsundoku/icons`;

const ALLOWED_MIME: Record<string, string> = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
};

export const iconRoutes = new Hono()
  .use("*", authRequired)
  .get("/icons", async (c) => {
    const db = requireDb();
    return c.json(
      await db
        .select({
          id: schema.customIcons.id,
          name: schema.customIcons.name,
          fileName: schema.customIcons.fileName,
          mimeType: schema.customIcons.mimeType,
          uploadedAt: schema.customIcons.uploadedAt,
        })
        .from(schema.customIcons),
    );
  })
  .get("/icons/:id/file", sValidator("param", IdParam), async (c) => {
    const { id } = c.req.valid("param");
    const db = requireDb();
    const rows = await db
      .select()
      .from(schema.customIcons)
      .where(eq(schema.customIcons.id, id))
      .limit(1);
    const ico = rows[0];
    if (!ico) throw new HTTPException(404, { message: "Icon not found" });
    const file = Bun.file(path.join(ICON_DIR, ico.fileName));
    return new Response(file.stream(), {
      headers: {
        "Content-Type": ico.mimeType,
        "Cache-Control": "public, max-age=2592000, immutable",
      },
    });
  })
  .post("/icons", adminRequired, async (c) => {
    const form = await c.req.parseBody();
    const file = form["file"];
    const name = String(form["name"] ?? "").trim();
    if (!(file instanceof File)) throw new HTTPException(400, { message: "No file" });
    if (!name) throw new HTTPException(400, { message: "Name required" });
    const ext = path.extname(file.name).toLowerCase();
    const mime = ALLOWED_MIME[ext];
    if (!mime)
      throw new HTTPException(415, {
        message: `Unsupported format ${ext}. Use svg/png/webp.`,
      });
    await fs.mkdir(ICON_DIR, { recursive: true });
    const dest = path.join(ICON_DIR, `${crypto.randomUUID()}${ext}`);
    await Bun.write(dest, file);
    const db = requireDb();
    const inserted = await db
      .insert(schema.customIcons)
      .values({ name, fileName: path.basename(dest), mimeType: mime })
      .returning();
    return c.json(inserted[0], 201);
  })
  .delete("/icons/:id", adminRequired, sValidator("param", IdParam), async (c) => {
    const { id } = c.req.valid("param");
    const db = requireDb();
    const rows = await db
      .select()
      .from(schema.customIcons)
      .where(eq(schema.customIcons.id, id))
      .limit(1);
    const ico = rows[0];
    if (!ico) throw new HTTPException(404, { message: "Icon not found" });
    await fs.unlink(path.join(ICON_DIR, ico.fileName)).catch(() => {
      // best-effort — DB row is what matters
    });
    await db.delete(schema.customIcons).where(eq(schema.customIcons.id, id));
    return c.json({ ok: true });
  });
