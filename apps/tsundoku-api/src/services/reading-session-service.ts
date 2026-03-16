import { db, schema } from "../db/client";
import { eq, and, desc } from "drizzle-orm";
import { assertIsDefined } from "../http/errors";

export interface ReadingSessionRow {
  id: string;
  userId: string;
  bookId: string;
  bookType: string;
  startTime: Date;
  endTime: Date;
  durationSeconds: number;
  startProgress: number;
  endProgress: number;
  progressDelta: number;
  startLocation: string;
  endLocation: string;
  createdAt: Date;
}

export interface CreateReadingSessionInput {
  userId: string;
  bookId: string;
  bookType: string;
  startTime: Date;
  endTime: Date;
  durationSeconds: number;
  startProgress: number;
  endProgress: number;
  progressDelta: number;
  startLocation: string;
  endLocation: string;
}

const ensureDb = () => {
  if (!db) {
    throw new Error("Database not configured");
  }
  return db;
};

export const recordReadingSession = async (input: CreateReadingSessionInput): Promise<void> => {
  const database = ensureDb();
  
  await database.insert(schema.readingSessions).values({
    id: Bun.randomUUIDv7(),
    userId: input.userId,
    bookId: input.bookId,
    bookType: input.bookType,
    startTime: input.startTime,
    endTime: input.endTime,
    durationSeconds: input.durationSeconds,
    startProgress: input.startProgress,
    endProgress: input.endProgress,
    progressDelta: input.progressDelta,
    startLocation: input.startLocation,
    endLocation: input.endLocation,
    createdBy: input.userId,
  });
};

export const getReadingSessionsForBook = async (
  bookId: string,
  userId: string,
  page: number = 0,
  size: number = 5
): Promise<{ sessions: ReadingSessionRow[]; total: number }> => {
  const database = ensureDb();
  
  const sessions = await database
    .select()
    .from(schema.readingSessions)
    .where(and(
      eq(schema.readingSessions.bookId, bookId),
      eq(schema.readingSessions.userId, userId)
    ))
    .orderBy(desc(schema.readingSessions.startTime))
    .limit(size)
    .offset(page * size);
  
  const countResult = await database
    .select({ count: schema.readingSessions.id })
    .from(schema.readingSessions)
    .where(and(
      eq(schema.readingSessions.bookId, bookId),
      eq(schema.readingSessions.userId, userId)
    ));
  
  const total = countResult.length > 0 ? 1 : 0;
  
  return { sessions, total: sessions.length };
};

export const getReadingSessionsByUser = async (userId: string): Promise<ReadingSessionRow[]> => {
  const database = ensureDb();
  
  return await database
    .select()
    .from(schema.readingSessions)
    .where(eq(schema.readingSessions.userId, userId))
    .orderBy(desc(schema.readingSessions.startTime));
};

export const getTotalReadingTimeForBook = async (bookId: string, userId: string): Promise<number> => {
  const database = ensureDb();
  
  const result = await database
    .select({ total: schema.readingSessions.durationSeconds })
    .from(schema.readingSessions)
    .where(and(
      eq(schema.readingSessions.bookId, bookId),
      eq(schema.readingSessions.userId, userId)
    ));
  
  return result.reduce((sum, session) => sum + session.total, 0);
};
