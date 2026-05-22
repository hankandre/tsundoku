import { and, eq, desc, sql } from "drizzle-orm";
import { schema } from "@tsundoku/db";
import { requireDb } from "../db.ts";

export async function getProgress(userId: string, bookId: string) {
  const db = requireDb();
  const rows = await db
    .select()
    .from(schema.userBookProgress)
    .where(
      and(eq(schema.userBookProgress.userId, userId), eq(schema.userBookProgress.bookId, bookId)),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function setProgress(input: {
  userId: string;
  bookId: string;
  pdfProgress?: number | null;
  epubProgress?: string | null;
  audiobookProgressSeconds?: number | null;
  finishedAt?: Date | null;
}) {
  const db = requireDb();
  const existing = await getProgress(input.userId, input.bookId);
  if (existing) {
    await db
      .update(schema.userBookProgress)
      .set({
        pdfProgress: input.pdfProgress ?? existing.pdfProgress,
        epubProgress: input.epubProgress ?? existing.epubProgress,
        audiobookProgressSeconds:
          input.audiobookProgressSeconds ?? existing.audiobookProgressSeconds,
        finishedAt: input.finishedAt ?? existing.finishedAt,
        updatedAt: new Date(),
      })
      .where(eq(schema.userBookProgress.id, existing.id));
  } else {
    await db.insert(schema.userBookProgress).values({
      userId: input.userId,
      bookId: input.bookId,
      pdfProgress: input.pdfProgress ?? null,
      epubProgress: input.epubProgress ?? null,
      audiobookProgressSeconds: input.audiobookProgressSeconds ?? null,
      finishedAt: input.finishedAt ?? null,
    });
  }
}

export async function startSession(input: {
  userId: string;
  bookId: string;
  startLocation?: string | null;
}) {
  const db = requireDb();
  const inserted = await db
    .insert(schema.readingSessions)
    .values({
      userId: input.userId,
      bookId: input.bookId,
      startTime: new Date(),
      startLocation: input.startLocation ?? null,
    })
    .returning({ id: schema.readingSessions.id });
  return inserted[0]!.id;
}

export async function endSession(input: {
  userId: string;
  sessionId: string;
  endLocation?: string | null;
}) {
  const db = requireDb();
  const now = new Date();
  await db
    .update(schema.readingSessions)
    .set({
      endTime: now,
      endLocation: input.endLocation ?? null,
      durationSeconds: sql`extract(epoch from (${now.toISOString()}::timestamptz - start_time))::int`,
    })
    .where(
      and(
        eq(schema.readingSessions.id, input.sessionId),
        eq(schema.readingSessions.userId, input.userId),
      ),
    );
}

export async function listSessions(userId: string, bookId: string, limit = 50) {
  const db = requireDb();
  return db
    .select()
    .from(schema.readingSessions)
    .where(
      and(eq(schema.readingSessions.userId, userId), eq(schema.readingSessions.bookId, bookId)),
    )
    .orderBy(desc(schema.readingSessions.startTime))
    .limit(limit);
}
