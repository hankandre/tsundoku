import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { sValidator } from "@hono/standard-validator";
import { type } from "arktype";
import { eq } from "drizzle-orm";
import { schema } from "@tsundoku/db";
import { requireDb } from "../db.ts";
import { authRequired } from "../middleware/auth.ts";

/**
 * Komga integration. We store per-user Komga server credentials and provide
 * test + sync trigger endpoints. The actual sync runner (fetch series/books,
 * insert tsundoku rows pointing at a Komga proxy library) is its own slice;
 * for now /sync returns 501 with a clear gap message.
 */

const SettingsBody = type({
  "baseUrl?": "string.url | null",
  "username?": "string | null",
  "password?": "string | null",
});

const TestBody = type({
  baseUrl: "string.url",
  "username?": "string | null",
  "password?": "string | null",
});

async function komgaPing(input: {
  baseUrl: string;
  username: string | null;
  password: string | null;
}): Promise<{ ok: boolean; status: number; detail?: string }> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (input.username && input.password) {
    headers.Authorization =
      "Basic " + btoa(`${input.username}:${input.password}`);
  }
  try {
    const res = await fetch(`${input.baseUrl.replace(/\/$/, "")}/api/v2/users/me`, {
      headers,
    });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}

export const komgaRoutes = new Hono()
  .use("*", authRequired)
  .get("/komga/settings", async (c) => {
    const u = c.var.user!;
    const db = requireDb();
    const rows = await db
      .select({
        baseUrl: schema.komgaSettings.baseUrl,
        username: schema.komgaSettings.username,
        lastSyncAt: schema.komgaSettings.lastSyncAt,
      })
      .from(schema.komgaSettings)
      .where(eq(schema.komgaSettings.userId, u.id))
      .limit(1);
    return c.json({
      configured: !!rows[0]?.baseUrl,
      baseUrl: rows[0]?.baseUrl ?? null,
      username: rows[0]?.username ?? null,
      lastSyncAt: rows[0]?.lastSyncAt ?? null,
    });
  })
  .put("/komga/settings", sValidator("json", SettingsBody), async (c) => {
    const u = c.var.user!;
    const body = c.req.valid("json");
    const db = requireDb();
    const existing = await db
      .select({ userId: schema.komgaSettings.userId })
      .from(schema.komgaSettings)
      .where(eq(schema.komgaSettings.userId, u.id))
      .limit(1);
    if (existing.length === 0) {
      await db.insert(schema.komgaSettings).values({
        userId: u.id,
        baseUrl: body.baseUrl ?? null,
        username: body.username ?? null,
        password: body.password ?? null,
      });
    } else {
      const patch: Record<string, unknown> = {};
      if (body.baseUrl !== undefined) patch.baseUrl = body.baseUrl;
      if (body.username !== undefined) patch.username = body.username;
      if (body.password !== undefined) patch.password = body.password;
      if (Object.keys(patch).length > 0) {
        await db
          .update(schema.komgaSettings)
          .set(patch)
          .where(eq(schema.komgaSettings.userId, u.id));
      }
    }
    return c.json({ ok: true });
  })
  // Verify connectivity without saving.
  .post(
    "/komga/test",
    sValidator("json", TestBody),
    async (c) => {
      const body = c.req.valid("json");
      const result = await komgaPing({
        baseUrl: body.baseUrl,
        username: body.username ?? null,
        password: body.password ?? null,
      });
      return c.json(result);
    },
  )
  .post("/komga/sync", async () => {
    throw new HTTPException(501, {
      message: "Komga sync runner not yet implemented",
    });
  });
