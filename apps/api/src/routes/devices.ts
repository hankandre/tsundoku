import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { sValidator } from "@hono/standard-validator";
import { type } from "arktype";
import { eq, and } from "drizzle-orm";
import { schema } from "@tsundoku/db";
import { requireDb } from "../db.ts";
import { findByUsername, verifyPassword } from "../services/users.ts";
import { setProgress, getProgress } from "../services/progress.ts";

/**
 * KOReader Sync protocol — minimal subset compatible with the open-source
 * sync server. Devices POST progress to `/syncs/progress` with a custom
 * `X-Auth-User` / `X-Auth-Key` header pair. We treat the key as the user's
 * password for Phase 9; tightened to a per-device token in Phase 10.
 *
 * Kobo full sync is a much larger protocol — only a status ping is wired here;
 * /kobo/v1/library is reserved for a follow-up commit.
 */

async function authKoreader(req: Request) {
  const user = req.headers.get("X-Auth-User");
  const key = req.headers.get("X-Auth-Key");
  if (!user || !key) return null;
  const record = await findByUsername(user);
  if (!record) return null;
  return (await verifyPassword(record, key)) ? record : null;
}

const KoreaderProgressBody = type({
  document: "string > 0", // hash of the file
  progress: "string > 0", // CFI or page string
  percentage: "0 <= number <= 1",
  "device?": "string",
  "device_id?": "string",
  "timestamp?": "number",
});

export const deviceRoutes = new Hono()
  // KOReader: /syncs/users/auth → 200 if valid
  .get("/koreader/users/auth", async (c) => {
    const user = await authKoreader(c.req.raw);
    if (!user) throw new HTTPException(401, { message: "Invalid credentials" });
    return c.json({ username: user.username });
  })
  // KOReader: PUT progress
  .put("/koreader/syncs/progress", sValidator("json", KoreaderProgressBody), async (c) => {
    const user = await authKoreader(c.req.raw);
    if (!user) throw new HTTPException(401, { message: "Invalid credentials" });
    const body = c.req.valid("json");

    // KOReader identifies books by file hash, not our internal id. We persist
    // the progress against the most recently scanned book whose filename hashes
    // match (a stricter mapping requires hashing files during scan — Phase 11).
    // For now we just upsert a global "koreader" setting under user_settings so
    // the device doesn't lose its state.
    const db = requireDb();
    const existing = await db
      .select()
      .from(schema.userSettings)
      .where(
        and(
          eq(schema.userSettings.userId, user.id),
          eq(schema.userSettings.settingKey, `koreader:${body.document}`),
        ),
      )
      .limit(1);
    if (existing.length === 0) {
      await db.insert(schema.userSettings).values({
        userId: user.id,
        settingKey: `koreader:${body.document}`,
        settingValue: body,
      });
    } else {
      await db
        .update(schema.userSettings)
        .set({ settingValue: body })
        .where(
          and(
            eq(schema.userSettings.userId, user.id),
            eq(schema.userSettings.settingKey, `koreader:${body.document}`),
          ),
        );
    }
    return c.json({ document: body.document, timestamp: Date.now() });
  })
  .get("/koreader/syncs/progress/:document", async (c) => {
    const user = await authKoreader(c.req.raw);
    if (!user) throw new HTTPException(401, { message: "Invalid credentials" });
    const doc = c.req.param("document");
    const db = requireDb();
    const rows = await db
      .select()
      .from(schema.userSettings)
      .where(
        and(
          eq(schema.userSettings.userId, user.id),
          eq(schema.userSettings.settingKey, `koreader:${doc}`),
        ),
      )
      .limit(1);
    if (!rows[0]) throw new HTTPException(404, { message: "No progress" });
    return c.json(rows[0].settingValue);
  })

  // Kobo: this is the externally visible surface of Booklore's Kobo controller.
  // Most handlers return safe defaults so a Kobo device probing the endpoint
  // sees a valid shape and doesn't hard-crash. The actual entitlement
  // delivery + KEPUB streaming is a larger slice; these stubs unblock
  // pairing flows.
  .get("/kobo/v1/initialization", (c) =>
    c.json({
      Resources: {
        api_endpoint: "/api/v1/kobo/v1",
        image_host: "/api/v1/kobo/v1/images",
        download_metrics_url: "/api/v1/kobo/v1/metrics",
        affiliateaction: "/api/v1/kobo/v1/affiliate",
      },
      AccessToken: "stub",
      Resource: { type: "Library", Id: "tsundoku" },
    }),
  )
  .get("/kobo/v1/library/sync", (c) => c.json({ NewEntitlements: [] }))
  .post("/kobo/v1/library/sync", (c) => c.json({ NewEntitlements: [] }))
  .get("/kobo/v1/library/:id/metadata", (c) =>
    c.json({ Entitlement: null, Metadata: null }),
  )
  .get("/kobo/v1/library/:id/state", (c) =>
    c.json({ StatusInfo: { Status: "ReadyToRead" }, CurrentBookmark: null }),
  )
  .put("/kobo/v1/library/:id/state", (c) =>
    // Echo back; the legacy app persists this against userBookProgress.
    c.json({ RequestResult: "Success" }),
  )
  .delete("/kobo/v1/library/:id", (c) => c.json({ RequestResult: "Success" }))
  // Kobo's CDN-style image fetch; we fall through to /books/:id/cover.
  .get("/kobo/v1/images/:id", async (c) => {
    const id = c.req.param("id");
    return c.redirect(`/api/v1/books/${id}/cover`);
  })
  // Tags/collections — return empty until shelves<->Kobo mapping lands.
  .get("/kobo/v1/library/tags", (c) => c.json([]))
  .post("/kobo/v1/library/tags", (c) => c.json({ RequestResult: "Success" }))
  .get("/kobo/v1/affiliate", (c) => c.json({ AffiliateName: "tsundoku" }))
  .post("/kobo/v1/metrics", (c) => c.json({}))
  .get("/kobo/v1/products/featured/", (c) => c.json({ FeaturedLists: [] }))
  .get("/kobo/v1/products/books/external/:isbn", (c) => c.json({ Entitlement: null }));
