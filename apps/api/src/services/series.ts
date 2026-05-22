import { sql, eq, asc, and, inArray, isNotNull } from "drizzle-orm";
import { schema } from "@tsundoku/db";
import { requireDb } from "../db.ts";

export type SeriesSummary = {
  name: string;
  bookCount: number;
};

export async function listSeries(): Promise<SeriesSummary[]> {
  const db = requireDb();
  const rows = await db
    .select({
      name: schema.bookMetadata.seriesName,
      count: sql<number>`count(${schema.bookMetadata.bookId})::int`,
    })
    .from(schema.bookMetadata)
    .where(isNotNull(schema.bookMetadata.seriesName))
    .groupBy(schema.bookMetadata.seriesName)
    .orderBy(asc(schema.bookMetadata.seriesName));
  return rows
    .filter((r) => !!r.name)
    .map((r) => ({ name: r.name!, bookCount: r.count }));
}

export async function getSeriesBooks(name: string, allowed: string[] | "all") {
  const db = requireDb();
  const baseWhere = eq(schema.bookMetadata.seriesName, name);
  const where =
    allowed === "all"
      ? baseWhere
      : and(baseWhere, inArray(schema.books.libraryId, allowed));
  const rows = await db
    .select({
      id: schema.books.id,
      fileName: schema.books.fileName,
      bookType: schema.books.bookType,
      title: schema.bookMetadata.title,
      seriesNumber: schema.bookMetadata.seriesNumber,
    })
    .from(schema.bookMetadata)
    .innerJoin(schema.books, eq(schema.books.id, schema.bookMetadata.bookId))
    .where(where)
    .orderBy(asc(schema.bookMetadata.seriesNumber), asc(schema.bookMetadata.title));
  return rows;
}
