import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { eq, and } from "drizzle-orm";
import { schema } from "@tsundoku/db";
import { requireDb } from "../db.ts";
import { env } from "../env.ts";

/**
 * Public, unauthenticated endpoints. Anything here must be safe to expose to
 * any caller — version info, public branding settings, OIDC discovery.
 *
 * The "public-" prefix on the app_settings category is a soft contract: only
 * categories matching /^public(:|$)/ are surfaced here.
 */

function isPublicCategory(cat: string): boolean {
  return cat === "public" || cat.startsWith("public:");
}

export const publicRoutes = new Hono()
  .get("/version", (c) =>
    c.json({
      version: env.APP_VERSION,
      env: env.NODE_ENV,
    }),
  )
  // List every entry under a "public*" category. UI uses this to render brand
  // name, signup-enabled, etc. before the user is authenticated.
  .get("/public-settings", async (c) => {
    const db = requireDb();
    const rows = await db.select().from(schema.appSettings);
    return c.json(rows.filter((r) => isPublicCategory(r.category)));
  })
  .get("/public-settings/:category/:name", async (c) => {
    const category = c.req.param("category");
    const name = c.req.param("name");
    if (!category || !name) throw new HTTPException(400, { message: "Bad path" });
    if (!isPublicCategory(category))
      throw new HTTPException(404, { message: "Not a public setting" });
    const db = requireDb();
    const rows = await db
      .select()
      .from(schema.appSettings)
      .where(
        and(
          eq(schema.appSettings.category, category),
          eq(schema.appSettings.name, name),
        ),
      )
      .limit(1);
    const r = rows[0];
    if (!r) throw new HTTPException(404, { message: "Setting not found" });
    return c.json(r);
  });
