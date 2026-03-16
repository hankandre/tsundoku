import path from "path";
import { exists } from "fs/promises";
import { and, eq } from "drizzle-orm";
import { db, schema } from "../../db/client";
import { fail } from "../../http/errors";
import { getLibraryById, getLibraryPathsByLibraryId } from "../library-service";
import { scanLibraryPathForBookFiles } from "../../lib/filesystem/library-file-scanner";
import { extractEpubMetadata } from "../../lib/epub/epub-metadata-extractor";

export interface DiscoverySummary {
  scanned: number;
  imported: number;
  skipped: number;
  failed: number;
}

const ensureDb = () => {
  if (!db) {
    fail(503, "Database is not configured. Set DATABASE_URL.");
  }

  return db;
};

const canAccessPath = async (directoryPath: string): Promise<boolean> => {
  try {
    return await exists(directoryPath);
  } catch {
    return false;
  }
};

const normalizePublishedDate = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  const trimmedValue = value.trim();
  if (/^\d{4}$/.test(trimmedValue)) {
    return `${trimmedValue}-01-01`;
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(trimmedValue)) {
    return trimmedValue.slice(0, 10);
  }

  const parsed = new Date(trimmedValue);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
};

const parseFileSizeKb = async (absolutePath: string): Promise<number | null> => {
  const file = Bun.file(absolutePath);
  const sizeBytes = file.size;
  if (!Number.isFinite(sizeBytes)) {
    return null;
  }

  return Math.max(1, Math.ceil(sizeBytes / 1024));
};

const getOrCreateAuthor = async (name: string, actorId: string | null): Promise<string> => {
  const database = ensureDb();
  const trimmedName = name.trim();
  if (trimmedName.length === 0) {
    return "";
  }

  const existingAuthor = await database
    .select({ id: schema.authors.id })
    .from(schema.authors)
    .where(eq(schema.authors.name, trimmedName))
    .limit(1);
  if (existingAuthor[0]) {
    return existingAuthor[0].id;
  }

  const inserted = await database
    .insert(schema.authors)
    .values({
      name: trimmedName,
      createdBy: actorId,
      updatedBy: actorId,
    })
    .returning({ id: schema.authors.id });

  return inserted[0].id;
};

const importBookFile = async (
  libraryId: string,
  libraryPathId: string,
  libraryRootPath: string,
  absolutePath: string,
  actorId: string | null,
): Promise<"imported" | "skipped"> => {
  const database = ensureDb();
  const fileName = path.basename(absolutePath);
  const fileSubPath = path.relative(libraryRootPath, absolutePath);

  const existingBook = await database
    .select({ id: schema.books.id })
    .from(schema.books)
    .where(and(eq(schema.books.libraryId, libraryId), eq(schema.books.fileName, fileName)))
    .limit(1);

  if (existingBook[0]) {
    return "skipped";
  }

  const metadata = await extractEpubMetadata(absolutePath);
  const fileSizeKb = await parseFileSizeKb(absolutePath);

  const insertedBook = await database
    .insert(schema.books)
    .values({
      fileName,
      fileSubPath,
      bookType: "EPUB",
      libraryId,
      libraryPathId,
      createdBy: actorId,
      updatedBy: actorId,
    })
    .returning({ id: schema.books.id });

  const bookId = insertedBook[0].id;

  await database.insert(schema.bookFile).values({
    bookId,
    fileName,
    fileSubPath,
    fileSizeKb,
    isBook: true,
    bookType: "EPUB",
    createdBy: actorId,
    updatedBy: actorId,
  });

  await database.insert(schema.bookMetadata).values({
    bookId,
    title: metadata.title,
    subtitle: metadata.subtitle,
    publisher: metadata.publisher,
    publishedDate: normalizePublishedDate(metadata.publishedDate),
    language: metadata.language,
    isbn10: metadata.isbn10,
    isbn13: metadata.isbn13,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  for (const authorName of metadata.authors) {
    const authorId = await getOrCreateAuthor(authorName, actorId);
    if (!authorId) {
      continue;
    }

    const existingMapping = await database
      .select({ bookId: schema.bookMetadataAuthorMapping.bookId })
      .from(schema.bookMetadataAuthorMapping)
      .where(
        and(
          eq(schema.bookMetadataAuthorMapping.bookId, bookId),
          eq(schema.bookMetadataAuthorMapping.authorId, authorId),
        ),
      )
      .limit(1);

    if (existingMapping[0]) {
      continue;
    }

    await database.insert(schema.bookMetadataAuthorMapping).values({
      bookId,
      authorId,
    });
  }

  return "imported";
};

export const scanLibraryById = async (libraryId: string, actorId: string | null): Promise<DiscoverySummary> => {
  const library = await getLibraryById(libraryId);
  if (!library) {
    fail(404, `Library not found: ${libraryId}`);
  }

  const libraryPaths = await getLibraryPathsByLibraryId(libraryId);
  const summary: DiscoverySummary = {
    scanned: 0,
    imported: 0,
    skipped: 0,
    failed: 0,
  };

  for (const libraryPath of libraryPaths) {
    if (!libraryPath.path) {
      continue;
    }

    const accessible = await canAccessPath(libraryPath.path);
    if (!accessible) {
      continue;
    }

    const discoveredFiles = await scanLibraryPathForBookFiles(libraryPath.path);

    for (const discoveredFile of discoveredFiles) {
      summary.scanned += 1;
      try {
        const importResult = await importBookFile(
          libraryId,
          libraryPath.id,
          libraryPath.path,
          discoveredFile.absolutePath,
          actorId,
        );
        if (importResult === "imported") {
          summary.imported += 1;
        } else {
          summary.skipped += 1;
        }
      } catch {
        summary.failed += 1;
      }
    }
  }

  return summary;
};
