import { db, schema } from "../db/client";
import { eq, and, inArray } from "drizzle-orm";
import { fail } from "../http/errors";

export interface UserBookProgressRow {
  id: string;
  userId: string;
  bookId: string;
  lastReadTime: Date | null;
  pdfProgress: number | null;
  epubProgress: string | null;
  readStatus: string | null;
  finished: boolean;
  personalRating: number | null;
  createdAt: Date;
  updatedAt: Date | null;
  createdBy: string | null;
  updatedBy: string | null;
}

const ensureDb = () => {
  if (!db) {
    fail(503, "Database is not configured. Set DATABASE_URL.");
  }
  return db;
};

export const getUserBookProgress = async (
  userId: string,
  bookId: string
): Promise<UserBookProgressRow | null> => {
  const database = ensureDb();

  const rows = await database
    .select()
    .from(schema.userBookProgress)
    .where(
      and(
        eq(schema.userBookProgress.userId, userId),
        eq(schema.userBookProgress.bookId, bookId)
      )
    )
    .limit(1);

  if (!rows[0]) return null;
  return rows[0] as UserBookProgressRow;
};

export const updateUserBookProgress = async (
  userId: string,
  bookId: string,
  progress: number,
  bookType: string
): Promise<UserBookProgressRow> => {
  const database = ensureDb();

  const existing = await getUserBookProgress(userId, bookId);

  if (existing) {
    const [updated] = await database
      .update(schema.userBookProgress)
      .set({
        lastReadTime: new Date(),
        pdfProgress: bookType === "pdf" ? progress : existing.pdfProgress,
        epubProgress: bookType === "epub" ? String(progress) : existing.epubProgress,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.userBookProgress.userId, userId),
          eq(schema.userBookProgress.bookId, bookId)
        )
      )
      .returning();

    return updated as UserBookProgressRow;
  }

  const [created] = await database
    .insert(schema.userBookProgress)
    .values({
      userId: userId,
      bookId: bookId,
      lastReadTime: new Date(),
      pdfProgress: bookType === "pdf" ? progress : null,
      epubProgress: bookType === "epub" ? String(progress) : null,
      createdBy: userId,
    })
    .returning();

  return created as UserBookProgressRow;
};

export const updateUserBookStatus = async (
  userId: string,
  bookIds: string[],
  status: string
): Promise<void> => {
  const database = ensureDb();

  for (const bookId of bookIds) {
    const existing = await getUserBookProgress(userId, bookId);

    if (existing) {
      await database
        .update(schema.userBookProgress)
        .set({
          readStatus: status,
          finished: status === "COMPLETED",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.userBookProgress.userId, userId),
            eq(schema.userBookProgress.bookId, bookId)
          )
        );
    } else {
      await database.insert(schema.userBookProgress).values({
        userId: userId,
        bookId: bookId,
        readStatus: status,
        finished: status === "COMPLETED",
        createdBy: userId,
      });
    }
  }
};

export const resetUserBookProgress = async (
  userId: string,
  bookIds: string[]
): Promise<void> => {
  const database = ensureDb();

  await database
    .update(schema.userBookProgress)
    .set({
      lastReadTime: null,
      pdfProgress: null,
      epubProgress: null,
      finished: false,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.userBookProgress.userId, userId),
        inArray(schema.userBookProgress.bookId, bookIds)
      )
    );
};

export const updatePersonalRating = async (
  userId: string,
  bookIds: string[],
  rating: number
): Promise<void> => {
  const database = ensureDb();

  for (const bookId of bookIds) {
    const existing = await getUserBookProgress(userId, bookId);

    if (existing) {
      await database
        .update(schema.userBookProgress)
        .set({
          personalRating: rating,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.userBookProgress.userId, userId),
            eq(schema.userBookProgress.bookId, bookId)
          )
        );
    } else {
      await database.insert(schema.userBookProgress).values({
        userId: userId,
        bookId: bookId,
        personalRating: rating,
        createdBy: userId,
      });
    }
  }
};

export const resetPersonalRating = async (
  userId: string,
  bookIds: string[]
): Promise<void> => {
  const database = ensureDb();

  await database
    .update(schema.userBookProgress)
    .set({
      personalRating: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.userBookProgress.userId, userId),
        inArray(schema.userBookProgress.bookId, bookIds)
      )
    );
};
