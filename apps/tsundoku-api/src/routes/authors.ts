import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppVariables } from "../types/app-variables";
import { fail } from "../http/errors";
import { requireAdmin } from "../middleware/auth-middleware";
import {
  getAllAuthors,
  getAuthorByName,
  getAuthorsByBookId,
  getAuthorById,
  updateAuthor,
  deleteAuthors,
  searchAuthorMetadata,
  quickMatchAuthor,
} from "../services/author-service";

const getAuthUser = (c: import("hono").Context) => {
  const authUser = c.get("authUser");
  if (!authUser) {
    fail(401, "Unauthorized");
  }
  return authUser;
};

const authorIdParamSchema = z.object({
  authorId: z.string(),
});

const nameQuerySchema = z.object({
  name: z.string(),
});

const bookIdParamSchema = z.object({
  bookId: z.string(),
});

const updateAuthorSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  asin: z.string().optional(),
});

const authorIdsSchema = z.object({
  authorIds: z.array(z.string()),
});

export const authorRoutes = new Hono<{ Variables: AppVariables }>();

authorRoutes.get("/", async (c) => {
  const authors = await getAllAuthors();
  return c.json(authors);
});

authorRoutes.get("/by-name", zValidator("query", nameQuerySchema, handleValidationError), async (c) => {
  const { name } = c.req.valid("query");
  const author = await getAuthorByName(name);

  if (!author) {
    fail(404, `Author not found: ${name}`);
  }

  return c.json(author);
});

authorRoutes.get("/book/:bookId", zValidator("param", bookIdParamSchema, handleValidationError), async (c) => {
  const { bookId } = c.req.valid("param");
  const authors = await getAuthorsByBookId(bookId);
  return c.json(authors);
});

authorRoutes.get("/:authorId", zValidator("param", authorIdParamSchema, handleValidationError), async (c) => {
  const { authorId } = c.req.valid("param");
  const author = await getAuthorById(authorId);

  if (!author) {
    fail(404, `Author not found: ${authorId}`);
  }

  return c.json(author);
});

authorRoutes.put("/:authorId", zValidator("param", authorIdParamSchema, handleValidationError), zValidator("json", updateAuthorSchema, handleValidationError), async (c) => {
  const authUser = getAuthUser(c);
  if (!authUser.isAdmin) {
    fail(403, "Forbidden");
  }

  const { authorId } = c.req.valid("param");
  const input = c.req.valid("json");
  const updated = await updateAuthor(authorId, input);

  return c.json(updated);
});

authorRoutes.post("/:authorId/search-metadata", zValidator("param", authorIdParamSchema, handleValidationError), async (c) => {
  const authUser = getAuthUser(c);
  if (!authUser.isAdmin) {
    fail(403, "Forbidden");
  }

  const { authorId } = c.req.valid("param");
  const query = c.req.query("q");
  const results = await searchAuthorMetadata(authorId, query ?? "");

  return c.json(results);
});

authorRoutes.post("/:authorId/quick-match", zValidator("param", authorIdParamSchema, handleValidationError), async (c) => {
  const authUser = getAuthUser(c);
  if (!authUser.isAdmin) {
    fail(403, "Forbidden");
  }

  const { authorId } = c.req.valid("param");
  const result = await quickMatchAuthor(authorId);

  return c.json(result);
});

authorRoutes.delete("/", zValidator("json", authorIdsSchema, handleValidationError), async (c) => {
  const authUser = getAuthUser(c);
  if (!authUser.isAdmin) {
    fail(403, "Forbidden");
  }

  const { authorIds } = c.req.valid("json");
  await deleteAuthors(authorIds);

  return c.json({ success: true });
});

function handleValidationError(err: unknown) {
  if (err && typeof err === "object" && "issues" in err) {
    const issues = (err as { issues: Array<{ path: string; message: string }> }).issues;
    const messages = issues.map((i) => `${i.path}: ${i.message}`);
    fail(400, messages.join(", "));
  }
  fail(400, "Validation failed");
}
