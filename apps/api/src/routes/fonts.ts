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

const FONT_DIR = `${process.env.HOME ?? "."}/.tsundoku/fonts`;

const ALLOWED_MIME: Record<string, string> = {
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
};

export const fontRoutes = new Hono()
  .use("*", authRequired)
  .get("/fonts", async (c) => {
    const db = requireDb();
    return c.json(
      await db.select({
        id: schema.customFonts.id,
        name: schema.customFonts.name,
        fileName: schema.customFonts.fileName,
        mimeType: schema.customFonts.mimeType,
        uploadedAt: schema.customFonts.uploadedAt,
      }).from(schema.customFonts),
    );
  })
  .get("/fonts/:id/file", sValidator("param", IdParam), async (c) => {
    const { id } = c.req.valid("param");
    const db = requireDb();
    const rows = await db
      .select()
      .from(schema.customFonts)
      .where(eq(schema.customFonts.id, id))
      .limit(1);
    const f = rows[0];
    if (!f) throw new HTTPException(404, { message: "Font not found" });
    const filePath = path.join(FONT_DIR, f.fileName);
    const file = Bun.file(filePath);
    return new Response(file.stream(), {
      headers: {
        "Content-Type": f.mimeType,
        "Cache-Control": "public, max-age=2592000, immutable",
      },
    });
  })
  .post("/fonts", adminRequired, async (c) => {
    const form = await c.req.parseBody();
    const file = form["file"];
    const name = String(form["name"] ?? "").trim();
    if (!(file instanceof File)) throw new HTTPException(400, { message: "No file" });
    if (!name) throw new HTTPException(400, { message: "Name required" });
    const ext = path.extname(file.name).toLowerCase();
    const mime = ALLOWED_MIME[ext];
    if (!mime)
      throw new HTTPException(415, {
        message: `Unsupported font format ${ext}. Use woff/woff2/ttf/otf.`,
      });
    await fs.mkdir(FONT_DIR, { recursive: true });
    const dest = path.join(FONT_DIR, `${crypto.randomUUID()}${ext}`);
    await Bun.write(dest, file);
    const db = requireDb();
    const inserted = await db
      .insert(schema.customFonts)
      .values({ name, fileName: path.basename(dest), mimeType: mime })
      .returning();
    return c.json(inserted[0], 201);
  })
  .delete("/fonts/:id", adminRequired, sValidator("param", IdParam), async (c) => {
    const { id } = c.req.valid("param");
    const db = requireDb();
    const rows = await db
      .select()
      .from(schema.customFonts)
      .where(eq(schema.customFonts.id, id))
      .limit(1);
    const f = rows[0];
    if (!f) throw new HTTPException(404, { message: "Font not found" });
    await fs.unlink(path.join(FONT_DIR, f.fileName)).catch(() => {
      // best-effort — the DB row is what matters
    });
    await db.delete(schema.customFonts).where(eq(schema.customFonts.id, id));
    return c.json({ ok: true });
  });
