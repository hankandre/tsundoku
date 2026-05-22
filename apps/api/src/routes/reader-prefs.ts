import { Hono } from "hono";
import { sValidator } from "@hono/standard-validator";
import { type } from "arktype";
import { eq, and } from "drizzle-orm";
import { schema } from "@tsundoku/db";
import { requireDb } from "../db.ts";
import { authRequired } from "../middleware/auth.ts";
import { IdParam } from "../utils/schemas.ts";

/**
 * Reader preferences are stored under `user_settings` keyed by:
 *   `reader-prefs:global`        — defaults for every book
 *   `reader-prefs:book:<bookId>` — per-book overrides
 *
 * Shape is opaque to the API; the readers (PDF/EPUB/CBX) define their own
 * schema in shared types. We round-trip JSON.
 */

const PrefBody = type({
  value: "Record<string, unknown>",
});

async function readKey(userId: string, key: string) {
  const db = requireDb();
  const rows = await db
    .select()
    .from(schema.userSettings)
    .where(
      and(
        eq(schema.userSettings.userId, userId),
        eq(schema.userSettings.settingKey, key),
      ),
    )
    .limit(1);
  return rows[0]?.settingValue ?? null;
}

async function writeKey(userId: string, key: string, value: unknown) {
  const db = requireDb();
  const existing = await db
    .select({ userId: schema.userSettings.userId })
    .from(schema.userSettings)
    .where(
      and(
        eq(schema.userSettings.userId, userId),
        eq(schema.userSettings.settingKey, key),
      ),
    )
    .limit(1);
  if (existing.length === 0) {
    await db.insert(schema.userSettings).values({
      userId,
      settingKey: key,
      settingValue: value as Record<string, unknown>,
    });
  } else {
    await db
      .update(schema.userSettings)
      .set({ settingValue: value as Record<string, unknown> })
      .where(
        and(
          eq(schema.userSettings.userId, userId),
          eq(schema.userSettings.settingKey, key),
        ),
      );
  }
}

export const readerPrefsRoutes = new Hono()
  .use("*", authRequired)
  .get("/reader-prefs/global", async (c) => {
    const u = c.var.user!;
    return c.json({ value: await readKey(u.id, "reader-prefs:global") });
  })
  .put("/reader-prefs/global", sValidator("json", PrefBody), async (c) => {
    const u = c.var.user!;
    await writeKey(u.id, "reader-prefs:global", c.req.valid("json").value);
    return c.json({ ok: true });
  })
  .get("/reader-prefs/book/:id", sValidator("param", IdParam), async (c) => {
    const u = c.var.user!;
    const { id } = c.req.valid("param");
    return c.json({ value: await readKey(u.id, `reader-prefs:book:${id}`) });
  })
  .put(
    "/reader-prefs/book/:id",
    sValidator("param", IdParam),
    sValidator("json", PrefBody),
    async (c) => {
      const u = c.var.user!;
      const { id } = c.req.valid("param");
      await writeKey(u.id, `reader-prefs:book:${id}`, c.req.valid("json").value);
      return c.json({ ok: true });
    },
  );
