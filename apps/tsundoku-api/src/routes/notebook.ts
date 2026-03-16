import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppVariables } from "../types/app-variables";
import { fail } from "../http/errors";
import { getNotebookEntries, exportNotebookEntries, getBooksWithAnnotations } from "../services/notebook-service";

const getAuthUser = (c: import("hono").Context) => {
  const authUser = c.get("authUser");
  if (!authUser) {
    fail(401, "Unauthorized");
  }
  return authUser;
};

const typeArraySchema = z
  .string()
  .optional()
  .transform((val) => (val ? val.split(",") : undefined));

const notebookQuerySchema = z.object({
  page: z.coerce.number().int().min(0).default(0),
  size: z.coerce.number().int().min(1).max(100).default(50),
  types: typeArraySchema,
  bookId: z.string().optional(),
  search: z.string().optional(),
  sort: z.enum(["asc", "desc"]).default("desc"),
});

const exportQuerySchema = z.object({
  types: typeArraySchema,
  bookId: z.string().optional(),
  search: z.string().optional(),
  sort: z.enum(["asc", "desc"]).default("desc"),
});

const booksQuerySchema = z.object({
  search: z.string().optional(),
});

export const notebookRoutes = new Hono<{ Variables: AppVariables }>();

notebookRoutes.get("/", zValidator("query", notebookQuerySchema, handleValidationError), async (c) => {
  const authUser = getAuthUser(c);
  const { page, size, types, bookId, search, sort } = c.req.valid("query");

  const result = await getNotebookEntries(
    authUser.userId,
    page,
    size,
    types,
    bookId,
    search,
    sort
  );

  return c.json({
    content: result.entries,
    totalElements: result.total,
    totalPages: Math.ceil(result.total / size),
    page,
    size,
  });
});

notebookRoutes.get("/export", zValidator("query", exportQuerySchema, handleValidationError), async (c) => {
  const authUser = getAuthUser(c);
  const { types, bookId, search, sort } = c.req.valid("query");

  const entries = await exportNotebookEntries(
    authUser.userId,
    types,
    bookId,
    search,
    sort
  );

  return c.json(entries);
});

notebookRoutes.get("/books", zValidator("query", booksQuerySchema, handleValidationError), async (c) => {
  const authUser = getAuthUser(c);
  const { search } = c.req.valid("query");

  const books = await getBooksWithAnnotations(authUser.userId, search);

  return c.json(books);
});

function handleValidationError(err: unknown) {
  if (err && typeof err === "object" && "issues" in err) {
    const issues = (err as { issues: Array<{ path: string; message: string }> }).issues;
    const messages = issues.map((i) => `${i.path}: ${i.message}`);
    fail(400, messages.join(", "));
  }
  fail(400, "Validation failed");
}
