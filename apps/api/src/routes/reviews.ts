import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { sValidator } from "@hono/standard-validator";
import { type } from "arktype";
import { eq, and, desc } from "drizzle-orm";
import { schema } from "@tsundoku/db";
import { requireDb } from "../db.ts";
import { authRequired } from "../middleware/auth.ts";
import { IdParam } from "../utils/schemas.ts";

const ReviewBody = type({
  "rating?": "(0 <= number.integer <= 5) | null",
  "title?": "string | null",
  body: "1 <= string <= 20000",
  "isPublic?": "boolean",
});

const ReviewIdParam = type({
  reviewId: "string.uuid",
});

export const reviewRoutes = new Hono()
  .use("*", authRequired)
  // Public reviews for a book (anyone allowed to see the book sees them).
  .get("/books/:id/reviews", sValidator("param", IdParam), async (c) => {
    const { id } = c.req.valid("param");
    const db = requireDb();
    const rows = await db
      .select()
      .from(schema.bookReviews)
      .where(
        and(eq(schema.bookReviews.bookId, id), eq(schema.bookReviews.isPublic, true)),
      )
      .orderBy(desc(schema.bookReviews.updatedAt));
    return c.json(rows);
  })
  // The caller's own review (private or public) for a book.
  .get("/books/:id/my-review", sValidator("param", IdParam), async (c) => {
    const u = c.var.user!;
    const { id } = c.req.valid("param");
    const db = requireDb();
    const rows = await db
      .select()
      .from(schema.bookReviews)
      .where(
        and(eq(schema.bookReviews.bookId, id), eq(schema.bookReviews.userId, u.id)),
      )
      .limit(1);
    return c.json(rows[0] ?? null);
  })
  .post(
    "/books/:id/reviews",
    sValidator("param", IdParam),
    sValidator("json", ReviewBody),
    async (c) => {
      const u = c.var.user!;
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const db = requireDb();
      const inserted = await db
        .insert(schema.bookReviews)
        .values({
          userId: u.id,
          bookId: id,
          rating: body.rating ?? null,
          title: body.title ?? null,
          body: body.body,
          isPublic: body.isPublic ?? false,
        })
        .returning();
      return c.json(inserted[0], 201);
    },
  )
  .put(
    "/reviews/:reviewId",
    sValidator("param", ReviewIdParam),
    sValidator("json", ReviewBody),
    async (c) => {
      const u = c.var.user!;
      const { reviewId } = c.req.valid("param");
      const body = c.req.valid("json");
      const db = requireDb();
      const result = await db
        .update(schema.bookReviews)
        .set({
          rating: body.rating ?? null,
          title: body.title ?? null,
          body: body.body,
          isPublic: body.isPublic ?? false,
          updatedAt: new Date(),
        })
        .where(
          and(eq(schema.bookReviews.id, reviewId), eq(schema.bookReviews.userId, u.id)),
        )
        .returning({ id: schema.bookReviews.id });
      if (result.length === 0)
        throw new HTTPException(404, { message: "Review not found" });
      return c.json({ ok: true });
    },
  )
  .delete("/reviews/:reviewId", sValidator("param", ReviewIdParam), async (c) => {
    const u = c.var.user!;
    const { reviewId } = c.req.valid("param");
    const db = requireDb();
    const result = await db
      .delete(schema.bookReviews)
      .where(
        and(eq(schema.bookReviews.id, reviewId), eq(schema.bookReviews.userId, u.id)),
      )
      .returning({ id: schema.bookReviews.id });
    if (result.length === 0)
      throw new HTTPException(404, { message: "Review not found" });
    return c.json({ ok: true });
  });
