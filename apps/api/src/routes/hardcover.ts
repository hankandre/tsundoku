import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { sValidator } from "@hono/standard-validator";
import { type } from "arktype";
import { eq } from "drizzle-orm";
import { schema } from "@tsundoku/db";
import { requireDb } from "../db.ts";
import { authRequired } from "../middleware/auth.ts";

/**
 * Hardcover.app sync settings. The actual sync runner is a separate slice
 * (queue job that reads finished books + ratings since lastSyncAt and posts
 * to Hardcover's GraphQL API). For now the endpoints expose:
 *   - GET  /hardcover/settings   — current settings (token masked)
 *   - PUT  /hardcover/settings   — save token + enable/disable sync
 *   - POST /hardcover/sync       — trigger a one-shot sync (returns 501 until
 *     the runner lands)
 */

const SettingsBody = type({
  "apiToken?": "string | null",
  "syncEnabled?": "boolean",
});

export const hardcoverRoutes = new Hono()
  .use("*", authRequired)
  .get("/hardcover/settings", async (c) => {
    const u = c.var.user!;
    const db = requireDb();
    const rows = await db
      .select()
      .from(schema.hardcoverSettings)
      .where(eq(schema.hardcoverSettings.userId, u.id))
      .limit(1);
    const row = rows[0];
    return c.json({
      configured: !!row?.apiToken,
      syncEnabled: row?.syncEnabled ?? false,
      lastSyncAt: row?.lastSyncAt ?? null,
    });
  })
  .put("/hardcover/settings", sValidator("json", SettingsBody), async (c) => {
    const u = c.var.user!;
    const body = c.req.valid("json");
    const db = requireDb();
    const existing = await db
      .select({ userId: schema.hardcoverSettings.userId })
      .from(schema.hardcoverSettings)
      .where(eq(schema.hardcoverSettings.userId, u.id))
      .limit(1);
    if (existing.length === 0) {
      await db.insert(schema.hardcoverSettings).values({
        userId: u.id,
        apiToken: body.apiToken ?? null,
        syncEnabled: body.syncEnabled ?? false,
      });
    } else {
      const patch: Record<string, unknown> = {};
      if (body.apiToken !== undefined) patch.apiToken = body.apiToken;
      if (body.syncEnabled !== undefined) patch.syncEnabled = body.syncEnabled;
      if (Object.keys(patch).length > 0) {
        await db
          .update(schema.hardcoverSettings)
          .set(patch)
          .where(eq(schema.hardcoverSettings.userId, u.id));
      }
    }
    return c.json({ ok: true });
  })
  .post("/hardcover/sync", async () => {
    // Real sync runner: enqueue a `hardcover-sync` job (queue not yet wired).
    // For now we 501 with a useful message so clients see the gap clearly.
    throw new HTTPException(501, {
      message: "Hardcover sync runner not yet implemented",
    });
  });
