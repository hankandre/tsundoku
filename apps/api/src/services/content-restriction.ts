import { eq, and, sql, type SQL } from "drizzle-orm";
import { schema } from "@tsundoku/db";
import { requireDb } from "../db.ts";

/**
 * Content-rating ordinals. Higher = more restricted. Books with no age
 * rating at all are treated as allowed (ordinal 0).
 *
 * We accept multiple aliases per ordinal because providers disagree on
 * spelling (e.g. "PG13" vs "PG-13").
 */
const RATING_ORDER: Record<string, number> = {
  G: 1,
  PG: 2,
  "PG-13": 3,
  PG13: 3,
  TEEN: 3,
  T: 3,
  R: 4,
  MATURE: 5,
  M: 5,
  "NC-17": 6,
  NC17: 6,
  ADULT: 7,
  X: 7,
};

function ordinalFor(rating: string | null | undefined): number {
  if (!rating) return 0;
  return RATING_ORDER[rating.trim().toUpperCase()] ?? 0;
}

/**
 * Returns the max ordinal a user is allowed to see, or null if no
 * restriction is configured (read: unrestricted).
 */
export async function userMaxRatingOrdinal(userId: string): Promise<number | null> {
  const db = requireDb();
  const rows = await db
    .select({ max: schema.userContentRestriction.maxAgeRating })
    .from(schema.userContentRestriction)
    .where(eq(schema.userContentRestriction.userId, userId))
    .limit(1);
  const max = rows[0]?.max;
  if (!max) return null;
  return ordinalFor(max);
}

/**
 * A SQL fragment that filters books by their book_metadata.age_rating against
 * the user's restriction. Builders compose this into their WHERE clauses.
 *
 * The fragment evaluates each row's age_rating to its ordinal via a CASE
 * expression so we don't need a separate ordinal column.
 */
export function contentRestrictionFilter(maxOrdinal: number | null): SQL | undefined {
  if (maxOrdinal == null) return undefined;
  // Rows with NULL age_rating are passthrough (ordinal 0).
  return sql`
    coalesce((CASE upper(${schema.bookMetadata.ageRating})
      WHEN 'G' THEN 1
      WHEN 'PG' THEN 2
      WHEN 'PG-13' THEN 3
      WHEN 'PG13' THEN 3
      WHEN 'TEEN' THEN 3
      WHEN 'T' THEN 3
      WHEN 'R' THEN 4
      WHEN 'MATURE' THEN 5
      WHEN 'M' THEN 5
      WHEN 'NC-17' THEN 6
      WHEN 'NC17' THEN 6
      WHEN 'ADULT' THEN 7
      WHEN 'X' THEN 7
      ELSE 0
    END), 0) <= ${maxOrdinal}
  `;
}

/** Get + set helpers for the admin API. */
export async function getUserRestriction(userId: string): Promise<string | null> {
  const db = requireDb();
  const rows = await db
    .select()
    .from(schema.userContentRestriction)
    .where(eq(schema.userContentRestriction.userId, userId))
    .limit(1);
  return rows[0]?.maxAgeRating ?? null;
}

export async function setUserRestriction(userId: string, maxAgeRating: string | null): Promise<void> {
  const db = requireDb();
  const existing = await db
    .select({ userId: schema.userContentRestriction.userId })
    .from(schema.userContentRestriction)
    .where(eq(schema.userContentRestriction.userId, userId))
    .limit(1);
  if (existing.length === 0) {
    await db.insert(schema.userContentRestriction).values({ userId, maxAgeRating });
  } else {
    await db
      .update(schema.userContentRestriction)
      .set({ maxAgeRating })
      .where(eq(schema.userContentRestriction.userId, userId));
  }
}

/** Check a single book against a user's restriction. */
export async function userCanSeeBook(userId: string, bookId: string): Promise<boolean> {
  const max = await userMaxRatingOrdinal(userId);
  if (max == null) return true;
  const db = requireDb();
  const rows = await db
    .select({ ageRating: schema.bookMetadata.ageRating })
    .from(schema.bookMetadata)
    .where(eq(schema.bookMetadata.bookId, bookId))
    .limit(1);
  return ordinalFor(rows[0]?.ageRating) <= max;
}

// Re-export helper for tests / debug.
export { ordinalFor };
// Silence unused-import warnings in some downstream consumers.
void and;
