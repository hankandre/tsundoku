import { and, eq, sql, count, inArray } from "drizzle-orm";
import { schema } from "@tsundoku/db";
import { requireDb } from "../db.ts";

async function allowedLibraryIds(userId: string, isAdmin: boolean): Promise<string[] | "all"> {
  if (isAdmin) return "all";
  const db = requireDb();
  const rows = await db
    .select({ libraryId: schema.userLibraryMapping.libraryId })
    .from(schema.userLibraryMapping)
    .where(eq(schema.userLibraryMapping.userId, userId));
  return rows.map((r) => r.libraryId);
}

export async function librarySummary(userId: string, isAdmin: boolean) {
  const db = requireDb();
  const allowed = await allowedLibraryIds(userId, isAdmin);
  if (allowed !== "all" && allowed.length === 0) {
    return { totalBooks: 0, byLibrary: [], byFormat: [], byLanguage: [] };
  }

  const where =
    allowed === "all" ? sql`true` : inArray(schema.books.libraryId, allowed);

  const total = await db
    .select({ count: count() })
    .from(schema.books)
    .where(where);

  const byLib = await db
    .select({
      libraryId: schema.books.libraryId,
      libraryName: schema.libraries.name,
      count: count(),
    })
    .from(schema.books)
    .innerJoin(schema.libraries, eq(schema.libraries.id, schema.books.libraryId))
    .where(where)
    .groupBy(schema.books.libraryId, schema.libraries.name);

  const byFormat = await db
    .select({ bookType: schema.books.bookType, count: count() })
    .from(schema.books)
    .where(where)
    .groupBy(schema.books.bookType);

  const byLanguage = await db
    .select({ language: schema.bookMetadata.language, count: count() })
    .from(schema.books)
    .innerJoin(schema.bookMetadata, eq(schema.bookMetadata.bookId, schema.books.id))
    .where(where)
    .groupBy(schema.bookMetadata.language);

  return {
    totalBooks: total[0]?.count ?? 0,
    byLibrary: byLib,
    byFormat: byFormat,
    byLanguage: byLanguage.filter((r) => r.language),
  };
}

export async function readingStats(userId: string) {
  const db = requireDb();

  const sessionCountRow = await db
    .select({ count: count() })
    .from(schema.readingSessions)
    .where(eq(schema.readingSessions.userId, userId));

  const totalMinutesRow = await db
    .select({
      minutes: sql<number>`coalesce(sum(${schema.readingSessions.durationSeconds}) / 60, 0)::int`,
    })
    .from(schema.readingSessions)
    .where(eq(schema.readingSessions.userId, userId));

  const finishedRow = await db
    .select({ count: count() })
    .from(schema.userBookProgress)
    .where(
      and(
        eq(schema.userBookProgress.userId, userId),
        sql`${schema.userBookProgress.finishedAt} is not null`,
      ),
    );

  const recentSessions = await db
    .select({
      bookId: schema.readingSessions.bookId,
      startTime: schema.readingSessions.startTime,
      durationSeconds: schema.readingSessions.durationSeconds,
    })
    .from(schema.readingSessions)
    .where(eq(schema.readingSessions.userId, userId))
    .orderBy(sql`${schema.readingSessions.startTime} desc`)
    .limit(10);

  return {
    sessionCount: sessionCountRow[0]?.count ?? 0,
    minutesRead: totalMinutesRow[0]?.minutes ?? 0,
    booksFinished: finishedRow[0]?.count ?? 0,
    recentSessions,
  };
}

/**
 * Reading-time histogram bucketed by day. `bucket` is a Postgres `date_trunc`
 * unit ("day", "week", "month"). Range is the last N buckets ending at now.
 */
export async function readingTimeHistogram(
  userId: string,
  bucket: "day" | "week" | "month",
  buckets = 30,
): Promise<Array<{ bucket: Date; minutes: number; sessions: number }>> {
  const db = requireDb();
  const rows = await db.execute<{ bucket: Date; minutes: number; sessions: number }>(sql`
    SELECT
      date_trunc(${bucket}, start_time) AS bucket,
      coalesce(sum(duration_seconds), 0)::int / 60 AS minutes,
      count(*)::int AS sessions
    FROM reading_sessions
    WHERE user_id = ${userId}
      AND start_time >= now() - (${buckets} * interval '1 ${sql.raw(bucket)}')
    GROUP BY bucket
    ORDER BY bucket
  `);
  return rows as unknown as Array<{ bucket: Date; minutes: number; sessions: number }>;
}

/** Books finished per period (same bucketing semantics). */
export async function booksFinishedHistogram(
  userId: string,
  bucket: "day" | "week" | "month",
  buckets = 12,
): Promise<Array<{ bucket: Date; count: number }>> {
  const db = requireDb();
  const rows = await db.execute<{ bucket: Date; count: number }>(sql`
    SELECT
      date_trunc(${bucket}, finished_at) AS bucket,
      count(*)::int AS count
    FROM user_book_progress
    WHERE user_id = ${userId}
      AND finished_at IS NOT NULL
      AND finished_at >= now() - (${buckets} * interval '1 ${sql.raw(bucket)}')
    GROUP BY bucket
    ORDER BY bucket
  `);
  return rows as unknown as Array<{ bucket: Date; count: number }>;
}

/**
 * Hour-of-day distribution — the classic "when do I read" heatmap. Returns 24
 * buckets summing minutes-read in each. Useful for daily-pattern charts.
 */
export async function hourOfDayHistogram(
  userId: string,
): Promise<Array<{ hour: number; minutes: number }>> {
  const db = requireDb();
  const rows = await db.execute<{ hour: number; minutes: number }>(sql`
    SELECT
      extract(hour FROM start_time)::int AS hour,
      coalesce(sum(duration_seconds), 0)::int / 60 AS minutes
    FROM reading_sessions
    WHERE user_id = ${userId}
    GROUP BY hour
    ORDER BY hour
  `);
  // Backfill empty hours so the chart shows a full 24-slot axis even if some
  // hours have no sessions.
  const byHour = new Map<number, number>();
  for (const r of rows as unknown as Array<{ hour: number; minutes: number }>) {
    byHour.set(r.hour, r.minutes);
  }
  return Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    minutes: byHour.get(h) ?? 0,
  }));
}

/** Day-of-week distribution (Sunday=0..Saturday=6). */
export async function dayOfWeekHistogram(
  userId: string,
): Promise<Array<{ dow: number; minutes: number }>> {
  const db = requireDb();
  const rows = await db.execute<{ dow: number; minutes: number }>(sql`
    SELECT
      extract(dow FROM start_time)::int AS dow,
      coalesce(sum(duration_seconds), 0)::int / 60 AS minutes
    FROM reading_sessions
    WHERE user_id = ${userId}
    GROUP BY dow
    ORDER BY dow
  `);
  const byDow = new Map<number, number>();
  for (const r of rows as unknown as Array<{ dow: number; minutes: number }>) {
    byDow.set(r.dow, r.minutes);
  }
  return Array.from({ length: 7 }, (_, d) => ({ dow: d, minutes: byDow.get(d) ?? 0 }));
}

/**
 * Top authors by completed reads (a useful "who do you read most" leaderboard).
 */
export async function topAuthors(
  userId: string,
  limit = 10,
): Promise<Array<{ authorId: string; name: string; finished: number }>> {
  const db = requireDb();
  const rows = await db.execute<{ authorId: string; name: string; finished: number }>(sql`
    SELECT a.id AS "authorId", a.name, count(*)::int AS finished
    FROM user_book_progress p
    JOIN book_metadata_author_mapping m ON m.book_id = p.book_id
    JOIN authors a ON a.id = m.author_id
    WHERE p.user_id = ${userId}
      AND p.finished_at IS NOT NULL
    GROUP BY a.id, a.name
    ORDER BY finished DESC
    LIMIT ${limit}
  `);
  return rows as unknown as Array<{ authorId: string; name: string; finished: number }>;
}

/** Top series by completed reads. */
export async function topSeries(
  userId: string,
  limit = 10,
): Promise<Array<{ name: string; finished: number }>> {
  const db = requireDb();
  const rows = await db.execute<{ name: string; finished: number }>(sql`
    SELECT bm.series_name AS name, count(*)::int AS finished
    FROM user_book_progress p
    JOIN book_metadata bm ON bm.book_id = p.book_id
    WHERE p.user_id = ${userId}
      AND p.finished_at IS NOT NULL
      AND bm.series_name IS NOT NULL
    GROUP BY bm.series_name
    ORDER BY finished DESC
    LIMIT ${limit}
  `);
  return rows as unknown as Array<{ name: string; finished: number }>;
}

/**
 * Longest reading streak — number of consecutive days with at least one
 * session. Computed in SQL via a gaps-and-islands trick. Returns current and
 * all-time best.
 */
export async function readingStreaks(userId: string): Promise<{
  current: number;
  longest: number;
}> {
  const db = requireDb();
  const rows = await db.execute<{ current: number; longest: number }>(sql`
    WITH days AS (
      SELECT DISTINCT date_trunc('day', start_time)::date AS d
      FROM reading_sessions
      WHERE user_id = ${userId}
    ),
    runs AS (
      SELECT d, d - (row_number() OVER (ORDER BY d))::int * interval '1 day' AS grp FROM days
    ),
    streaks AS (
      SELECT count(*)::int AS len, max(d) AS last_day FROM runs GROUP BY grp
    )
    SELECT
      coalesce(max(CASE WHEN last_day >= current_date - interval '1 day' THEN len END), 0)::int AS current,
      coalesce(max(len), 0)::int AS longest
    FROM streaks
  `);
  const r = (rows as unknown as Array<{ current: number; longest: number }>)[0];
  return { current: r?.current ?? 0, longest: r?.longest ?? 0 };
}
