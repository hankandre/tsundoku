import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppVariables, AuthUser } from "../types/app-variables";
import { fail, handleValidationError } from "../http/errors";
import {
  getReviewsForBook,
  refreshReviews,
  deleteReview,
  deleteAllReviewsForBook,
} from "../services/book-review-service";

const getAuthUser = (c: import("hono").Context): AuthUser => {
  const authUser = c.get("authUser");
  if (!authUser) {
    fail(401, "Unauthorized");
  }
  return authUser as AuthUser;
};

const bookIdParamSchema = z.object({
  bookId: z.string(),
});

const reviewIdParamSchema = z.object({
  id: z.string(),
});

const validateBookId = zValidator("param", bookIdParamSchema, handleValidationError);
const validateReviewId = zValidator("param", reviewIdParamSchema, handleValidationError);

export const bookReviewRoutes = new Hono<{ Variables: AppVariables }>();

bookReviewRoutes.get("/book/:bookId", validateBookId, async (c) => {
  const { bookId } = c.req.valid("param");
  
  const reviews = await getReviewsForBook(bookId);
  
  if (reviews.length === 0) {
    return c.body(null, 204);
  }
  
  return c.json(reviews, 200);
});

bookReviewRoutes.post("/book/:bookId/refresh", validateBookId, async (c) => {
  const { bookId } = c.req.valid("param");
  
  const reviews = await refreshReviews(bookId);
  return c.json(reviews, 200);
});

bookReviewRoutes.delete("/:id", validateReviewId, async (c) => {
  const { id } = c.req.valid("param");
  
  await deleteReview(id);
  return c.body(null, 204);
});

bookReviewRoutes.delete("/book/:bookId", validateBookId, async (c) => {
  const { bookId } = c.req.valid("param");
  
  await deleteAllReviewsForBook(bookId);
  return c.body(null, 204);
});
