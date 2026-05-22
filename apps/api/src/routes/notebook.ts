import { Hono } from "hono";
import { sValidator } from "@hono/standard-validator";
import { type } from "arktype";
import { eq, and, desc } from "drizzle-orm";
import { schema } from "@tsundoku/db";
import { requireDb } from "../db.ts";
import { authRequired } from "../middleware/auth.ts";
import { IdParam } from "../utils/schemas.ts";

const NotebookBody = type({
  "title?": "string | null",
  content: "string > 0",
  "tags?": "string[]",
  "bookId?": "string.uuid | null",
});

export const notebookRoutes = new Hono()
  .use("*", authRequired)
  .get("/notebook", async (c) => {
    const u = c.var.user!;
    const db = requireDb();
    return c.json(
      await db
        .select()
        .from(schema.notebookEntries)
        .where(eq(schema.notebookEntries.userId, u.id))
        .orderBy(desc(schema.notebookEntries.updatedAt)),
    );
  })
  .post("/notebook", sValidator("json", NotebookBody), async (c) => {
    const u = c.var.user!;
    const db = requireDb();
    const body = c.req.valid("json");
    const inserted = await db
      .insert(schema.notebookEntries)
      .values({
        userId: u.id,
        bookId: body.bookId ?? null,
        title: body.title ?? null,
        content: body.content,
        tags: body.tags ?? [],
      })
      .returning();
    return c.json(inserted[0], 201);
  })
  .put(
    "/notebook/:id",
    sValidator("param", IdParam),
    sValidator("json", NotebookBody),
    async (c) => {
      const u = c.var.user!;
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const db = requireDb();
      await db
        .update(schema.notebookEntries)
        .set({
          title: body.title ?? null,
          content: body.content,
          tags: body.tags ?? [],
          bookId: body.bookId ?? null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.notebookEntries.id, id),
            eq(schema.notebookEntries.userId, u.id),
          ),
        );
      return c.json({ ok: true });
    },
  )
  .delete("/notebook/:id", sValidator("param", IdParam), async (c) => {
    const u = c.var.user!;
    const { id } = c.req.valid("param");
    const db = requireDb();
    await db
      .delete(schema.notebookEntries)
      .where(
        and(
          eq(schema.notebookEntries.id, id),
          eq(schema.notebookEntries.userId, u.id),
        ),
      );
    return c.json({ ok: true });
  });
