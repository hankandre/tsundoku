import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppVariables, AuthUser } from "../types/app-variables";
import { fail, handleValidationError } from "../http/errors";
import {
  getBookmarksForBook,
  getBookmarkById,
  createBookmark,
  updateBookmark,
  deleteBookmark,
} from "../services/bookmark-service";

const getAuthUser = (c: import("hono").Context): AuthUser => {
  const authUser = c.get("authUser");
  if (!authUser) {
    fail(401, "Unauthorized");
  }
  return authUser as AuthUser;
};

const createBookmarkSchema = z.object({
  bookId: z.string(),
  cfi: z.string().min(1),
  title: z.string().optional(),
});

const updateBookmarkSchema = z.object({
  cfi: z.string().min(1).optional(),
  title: z.string().optional(),
});

const bookmarkIdParamSchema = z.object({
  bookmarkId: z.string(),
});

const bookIdParamSchema = z.object({
  bookId: z.uuidv7(),
});

const validateBookmarkId = zValidator("param", bookmarkIdParamSchema, handleValidationError);
const validateBookId = zValidator("param", bookIdParamSchema, handleValidationError);

export const bookmarkRoutes = new Hono<{ Variables: AppVariables }>();

bookmarkRoutes.get("/book/:bookId", validateBookId, async (c) => {
  const authUser = getAuthUser(c);
  const { bookId } = c.req.valid("param");
  
  const bookmarks = await getBookmarksForBook(bookId, authUser.userId);
  return c.json(bookmarks, 200);
});

bookmarkRoutes.get("/:bookmarkId", validateBookmarkId, async (c) => {
  const authUser = getAuthUser(c);
  const { bookmarkId } = c.req.valid("param");
  
  const bookmark = await getBookmarkById(bookmarkId, authUser.userId);
  if (!bookmark) {
    fail(404, `Bookmark not found: ${bookmarkId}`);
  }
  
  return c.json(bookmark, 200);
});

bookmarkRoutes.post("/", zValidator("json", createBookmarkSchema, handleValidationError), async (c) => {
  const authUser = getAuthUser(c);
  const input = c.req.valid("json");
  
  const bookmark = await createBookmark(authUser.userId, input);
  return c.json(bookmark, 200);
});

bookmarkRoutes.put("/:bookmarkId", validateBookmarkId, zValidator("json", updateBookmarkSchema, handleValidationError), async (c) => {
  const authUser = getAuthUser(c);
  const { bookmarkId } = c.req.valid("param");
  const input = c.req.valid("json");
  
  const bookmark = await updateBookmark(bookmarkId, authUser.userId, input);
  return c.json(bookmark, 200);
});

bookmarkRoutes.delete("/:bookmarkId", validateBookmarkId, async (c) => {
  const authUser = getAuthUser(c);
  const { bookmarkId } = c.req.valid("param");
  
  await deleteBookmark(bookmarkId, authUser.userId);
  return c.body(null, 204);
});
