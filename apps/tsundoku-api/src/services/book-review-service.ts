import { db, schema } from "../db/client";
import { eq, and } from "drizzle-orm";
import { fail } from "../http/errors";

export interface BookReviewRow {
  id: string;
  userId: string;
  bookId: string;
  rating: number;
  reviewText: string | null;
  createdAt: Date;
  updatedAt: Date | null;
}

const ensureDb = () => {
  if (!db) {
    throw new Error("Database not configured");
  }
  return db;
};

export const getReviewsForBook = async (bookId: string): Promise<BookReviewRow[]> => {
  const database = ensureDb();
  
  return await database
    .select()
    .from(schema.publicBookReview)
    .where(eq(schema.publicBookReview.bookId, bookId));
};

export const refreshReviews = async (_bookId: string) => {
  fail(501, "Review refresh requires external metadata provider integration");
};

export const deleteReview = async (reviewId: string): Promise<void> => {
  const database = ensureDb();
  
  await database.delete(schema.publicBookReview).where(eq(schema.publicBookReview.id, reviewId));
};

export const deleteAllReviewsForBook = async (bookId: string): Promise<void> => {
  const database = ensureDb();
  
  await database.delete(schema.publicBookReview).where(eq(schema.publicBookReview.bookId, bookId));
};
