import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { sValidator } from "@hono/standard-validator";
import { type } from "arktype";
import { eq } from "drizzle-orm";
import { authRequired } from "../middleware/auth.ts";
import { listSeries, getSeriesBooks } from "../services/series.ts";
import { schema } from "@tsundoku/db";
import { requireDb } from "../db.ts";

async function allowedLibraries(userId: string, isAdmin: boolean): Promise<string[] | "all"> {
  if (isAdmin) return "all";
  const db = requireDb();
  const rows = await db
    .select({ libraryId: schema.userLibraryMapping.libraryId })
    .from(schema.userLibraryMapping)
    .where(eq(schema.userLibraryMapping.userId, userId));
  return rows.map((r) => r.libraryId);
}

const SeriesNameParam = type({ name: "string>0" });

export const seriesRoutes = new Hono()
  .use("*", authRequired)
  .get("/series", async (c) => c.json(await listSeries()))
  .get("/series/:name", sValidator("param", SeriesNameParam), async (c) => {
    const u = c.var.user!;
    const { name } = c.req.valid("param");
    const decoded = decodeURIComponent(name);
    const allowed = await allowedLibraries(u.id, u.isAdmin);
    const books = await getSeriesBooks(decoded, allowed);
    if (books.length === 0) throw new HTTPException(404, { message: "Series not found" });
    return c.json({ name: decoded, books });
  });
