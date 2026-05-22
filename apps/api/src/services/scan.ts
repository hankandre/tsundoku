import { eq, and } from "drizzle-orm";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { schema } from "@tsundoku/db";
import { requireDb } from "../db.ts";
import { logger } from "../logger.ts";
import { extractForType, titleFromFilename } from "./extractors/index.ts";
import { updateBookMetadata } from "./metadata.ts";
import { saveCover } from "./covers.ts";

const EXT_TO_TYPE: Record<string, schema.BookType> = {
  ".pdf": "PDF",
  ".epub": "EPUB",
  ".kepub": "EPUB",
  ".cbz": "CBX",
  ".cbr": "CBX",
  ".cb7": "CBX",
  ".mobi": "MOBI",
  ".azw3": "AZW3",
  ".fb2": "FB2",
  ".m4b": "AUDIOBOOK",
  ".m4a": "AUDIOBOOK",
  ".mp3": "AUDIOBOOK",
  ".flac": "AUDIOBOOK",
};

export type ScanResult = {
  libraryId: string;
  scanned: number;
  added: number;
  skipped: number;
  errors: { path: string; error: string }[];
};

async function* walk(dir: string): AsyncGenerator<string> {
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (e) {
    logger.warn({ dir, err: e }, "scan: readdir failed");
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile()) yield full;
  }
}

export async function ingestFile(input: {
  bookId: string;
  bookType: schema.BookType;
  absPath: string;
  fallbackTitle: string;
}): Promise<{ extracted: boolean; warning?: string }> {
  const extracted = await extractForType(input.bookType, input.absPath);

  await updateBookMetadata(input.bookId, {
    title: extracted.title ?? input.fallbackTitle,
    subtitle: extracted.subtitle ?? null,
    description: extracted.description ?? null,
    publisher: extracted.publisher ?? null,
    publishedDate: extracted.publishedDate ?? null,
    isbn10: extracted.isbn10 ?? null,
    isbn13: extracted.isbn13 ?? null,
    pageCount: extracted.pageCount ?? null,
    language: extracted.language ?? null,
    seriesName: extracted.seriesName ?? null,
    seriesNumber: extracted.seriesNumber ?? null,
    ...(extracted.authors ? { authors: extracted.authors } : {}),
    ...(extracted.categories ? { categories: extracted.categories } : {}),
  });

  if (extracted.cover) {
    try {
      await saveCover(input.bookId, extracted.cover.bytes, extracted.cover.contentType);
    } catch (e) {
      logger.warn({ err: e, bookId: input.bookId }, "saveCover failed");
    }
  }
  return {
    extracted: !extracted.warning,
    warning: extracted.warning,
  };
}

export async function scanLibrary(
  libraryId: string,
  setProgress?: (p: number, detail?: string) => void,
): Promise<ScanResult> {
  const db = requireDb();
  const paths = await db
    .select()
    .from(schema.libraryPaths)
    .where(eq(schema.libraryPaths.libraryId, libraryId));
  if (paths.length === 0) {
    return { libraryId, scanned: 0, added: 0, skipped: 0, errors: [] };
  }

  const result: ScanResult = { libraryId, scanned: 0, added: 0, skipped: 0, errors: [] };
  for (const libPath of paths) {
    setProgress?.(0, `Scanning ${libPath.path}`);
    for await (const file of walk(libPath.path)) {
      result.scanned += 1;
      const ext = path.extname(file).toLowerCase();
      const bookType = EXT_TO_TYPE[ext];
      if (!bookType) {
        result.skipped += 1;
        continue;
      }
      const fileName = path.basename(file);
      const sub = path.relative(libPath.path, path.dirname(file));

      try {
        const existing = await db
          .select({ id: schema.books.id })
          .from(schema.books)
          .where(
            and(
              eq(schema.books.libraryPathId, libPath.id),
              eq(schema.books.fileName, fileName),
            ),
          )
          .limit(1);
        if (existing.length > 0) {
          result.skipped += 1;
          continue;
        }

        const inserted = await db
          .insert(schema.books)
          .values({
            libraryId,
            libraryPathId: libPath.id,
            fileName,
            fileSubPath: sub || null,
            bookType,
            scannedOn: new Date(),
          })
          .returning({ id: schema.books.id });
        const bookId = inserted[0]?.id;
        if (!bookId) {
          result.errors.push({ path: file, error: "insert returned no id" });
          continue;
        }
        await ingestFile({
          bookId,
          bookType,
          absPath: file,
          fallbackTitle: titleFromFilename(fileName),
        });
        result.added += 1;
      } catch (e) {
        result.errors.push({
          path: file,
          error: e instanceof Error ? e.message : String(e),
        });
      }
      if (result.scanned % 25 === 0) {
        setProgress?.(undefined as unknown as number, `Scanned ${result.scanned} files`);
      }
    }
  }
  setProgress?.(1, `Done: +${result.added} books`);
  return result;
}
