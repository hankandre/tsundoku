import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { sValidator } from "@hono/standard-validator";
import { type } from "arktype";
import { eq, and } from "drizzle-orm";
import { schema } from "@tsundoku/db";
import { requireDb } from "../db.ts";
import { authRequired } from "../middleware/auth.ts";
import { IdParam } from "../utils/schemas.ts";

const PdfAnnotationBody = type({
  page: "number.integer >= 0",
  payload: "Record<string, unknown>",
});

const AnnotationIdParam = type({
  annotationId: "string.uuid",
});

export const annotationRoutes = new Hono()
  .use("*", authRequired)
  // List a user's PDF annotations for a book. Annotations are stored per
  // (user, book, page) — multiple pages return as separate rows.
  .get("/books/:id/pdf-annotations", sValidator("param", IdParam), async (c) => {
    const u = c.var.user!;
    const { id } = c.req.valid("param");
    const db = requireDb();
    const rows = await db
      .select()
      .from(schema.pdfAnnotations)
      .where(
        and(
          eq(schema.pdfAnnotations.userId, u.id),
          eq(schema.pdfAnnotations.bookId, id),
        ),
      );
    return c.json(rows);
  })
  .post(
    "/books/:id/pdf-annotations",
    sValidator("param", IdParam),
    sValidator("json", PdfAnnotationBody),
    async (c) => {
      const u = c.var.user!;
      const { id } = c.req.valid("param");
      const { page, payload } = c.req.valid("json");
      const db = requireDb();
      const inserted = await db
        .insert(schema.pdfAnnotations)
        .values({ userId: u.id, bookId: id, page, payload })
        .returning();
      return c.json(inserted[0], 201);
    },
  )
  .put(
    "/pdf-annotations/:annotationId",
    sValidator("param", AnnotationIdParam),
    sValidator("json", PdfAnnotationBody),
    async (c) => {
      const u = c.var.user!;
      const { annotationId } = c.req.valid("param");
      const { page, payload } = c.req.valid("json");
      const db = requireDb();
      const result = await db
        .update(schema.pdfAnnotations)
        .set({ page, payload })
        .where(
          and(
            eq(schema.pdfAnnotations.id, annotationId),
            eq(schema.pdfAnnotations.userId, u.id),
          ),
        )
        .returning({ id: schema.pdfAnnotations.id });
      if (result.length === 0)
        throw new HTTPException(404, { message: "Annotation not found" });
      return c.json({ ok: true });
    },
  )
  .delete(
    "/pdf-annotations/:annotationId",
    sValidator("param", AnnotationIdParam),
    async (c) => {
      const u = c.var.user!;
      const { annotationId } = c.req.valid("param");
      const db = requireDb();
      const result = await db
        .delete(schema.pdfAnnotations)
        .where(
          and(
            eq(schema.pdfAnnotations.id, annotationId),
            eq(schema.pdfAnnotations.userId, u.id),
          ),
        )
        .returning({ id: schema.pdfAnnotations.id });
      if (result.length === 0)
        throw new HTTPException(404, { message: "Annotation not found" });
      return c.json({ ok: true });
    },
  );
