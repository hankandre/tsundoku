import path from "path";
import { exists } from "fs/promises";
import { eq } from "drizzle-orm";
import { db, schema } from "../../db/client";
import { env } from "../../config/env";
import { fail } from "../../http/errors";
import { scanLibraryPathForBookFiles } from "../../lib/filesystem/library-file-scanner";

export interface BookdropScanSummary {
  scanned: number;
  added: number;
  skipped: number;
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

export const scanBookdropFolder = async (actorId: string | null): Promise<BookdropScanSummary> => {
  const database = ensureDb();
  const folderPath = env.bookdropFolder;
  if (!folderPath) {
    return {
      scanned: 0,
      added: 0,
      skipped: 0,
    };
  }

  const accessible = await canAccessPath(folderPath);
  if (!accessible) {
    return {
      scanned: 0,
      added: 0,
      skipped: 0,
    };
  }

  const bookFiles = await scanLibraryPathForBookFiles(folderPath);
  const summary: BookdropScanSummary = {
    scanned: 0,
    added: 0,
    skipped: 0,
  };

  for (const bookFile of bookFiles) {
    summary.scanned += 1;

    const existing = await database
      .select({ id: schema.bookdropFile.id })
      .from(schema.bookdropFile)
      .where(eq(schema.bookdropFile.filePath, bookFile.absolutePath))
      .limit(1);
    if (existing[0]) {
      summary.skipped += 1;
      continue;
    }

    const sizeBytes = Bun.file(bookFile.absolutePath).size;
    await database.insert(schema.bookdropFile).values({
      filePath: bookFile.absolutePath,
      fileName: path.basename(bookFile.absolutePath),
      fileSize: Number.isFinite(sizeBytes) ? sizeBytes : null,
      createdBy: actorId,
      updatedBy: actorId,
    });
    summary.added += 1;
  }

  return summary;
};
