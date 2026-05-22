import * as path from "node:path";
import * as fs from "node:fs/promises";
import * as fsSync from "node:fs";
import { schema } from "@tsundoku/db";
import { requireDb } from "../db.ts";
import { eq } from "drizzle-orm";
import { logger } from "../logger.ts";
import { ingestFile } from "./scan.ts";
import { titleFromFilename } from "./extractors/index.ts";

/**
 * Bookdrop watches a folder for new book files and stages them in a review
 * queue. Files are moved into the staged folder; the user picks which library
 * to finalize into via the UI.
 *
 * Phase-1 implementation: watch BOOKDROP_PATH using fs.watch, on stable file
 * (no size change for 1s) compute a stable id and store its abs path. The
 * "finalize into library" path then runs ingestFile and inserts a book.
 */

const EXT_TO_TYPE: Record<string, schema.BookType> = {
  ".pdf": "PDF",
  ".epub": "EPUB",
  ".cbz": "CBX",
  ".cbr": "CBX",
  ".mobi": "MOBI",
  ".azw3": "AZW3",
  ".fb2": "FB2",
  ".m4b": "AUDIOBOOK",
  ".mp3": "AUDIOBOOK",
};

export type StagedFile = {
  id: string;
  fileName: string;
  absPath: string;
  size: number;
  detectedType: schema.BookType | null;
  stagedAt: Date;
};

const staged = new Map<string, StagedFile>();
let watcher: fsSync.FSWatcher | null = null;
const stableTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function listStagedFiles(): StagedFile[] {
  return [...staged.values()].sort((a, b) => b.stagedAt.getTime() - a.stagedAt.getTime());
}

export function getStagedFile(id: string): StagedFile | null {
  return staged.get(id) ?? null;
}

export async function removeStagedFile(id: string, deleteFile = false): Promise<boolean> {
  const f = staged.get(id);
  if (!f) return false;
  staged.delete(id);
  if (deleteFile) {
    try {
      await fs.unlink(f.absPath);
    } catch (e) {
      logger.warn({ err: e, absPath: f.absPath }, "bookdrop: failed to delete staged file");
    }
  }
  return true;
}

/**
 * Finalize a staged file into a library: move it to the library path, insert a
 * book row, run the extractor, and remove from staging.
 */
export async function finalizeStagedFile(input: {
  stagedId: string;
  libraryId: string;
}): Promise<{ bookId: string; fileName: string } | { error: string }> {
  const f = staged.get(input.stagedId);
  if (!f) return { error: "Staged file not found" };
  const ext = path.extname(f.fileName).toLowerCase();
  const bookType = EXT_TO_TYPE[ext];
  if (!bookType) return { error: `Unsupported format ${ext}` };

  const db = requireDb();
  const paths = await db
    .select()
    .from(schema.libraryPaths)
    .where(eq(schema.libraryPaths.libraryId, input.libraryId));
  if (paths.length === 0) return { error: "Library has no paths configured" };
  const target = paths[0]!;

  let destName = f.fileName;
  let dest = path.join(target.path, destName);
  let suffix = 1;
  while (await pathExists(dest)) {
    const stem = path.basename(destName, ext);
    destName = `${stem}-${suffix}${ext}`;
    dest = path.join(target.path, destName);
    suffix++;
  }
  await fs.mkdir(target.path, { recursive: true });
  await fs.rename(f.absPath, dest).catch(async () => {
    // Cross-filesystem rename will EXDEV — copy+unlink instead.
    await fs.copyFile(f.absPath, dest);
    await fs.unlink(f.absPath);
  });

  const inserted = await db
    .insert(schema.books)
    .values({
      libraryId: input.libraryId,
      libraryPathId: target.id,
      fileName: destName,
      fileSubPath: null,
      bookType,
      scannedOn: new Date(),
    })
    .returning();
  const book = inserted[0]!;
  await ingestFile({
    bookId: book.id,
    bookType,
    absPath: dest,
    fallbackTitle: titleFromFilename(destName),
  });

  staged.delete(input.stagedId);
  return { bookId: book.id, fileName: destName };
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

function isSupported(name: string): boolean {
  return path.extname(name).toLowerCase() in EXT_TO_TYPE;
}

async function stageWhenStable(absPath: string, fileName: string) {
  // Wait for the file size to stop changing for 1s to avoid staging mid-write.
  const initial = await fs.stat(absPath).catch(() => null);
  if (!initial) return;
  const initSize = initial.size;
  const timer = setTimeout(async () => {
    stableTimers.delete(absPath);
    const stat = await fs.stat(absPath).catch(() => null);
    if (!stat) return;
    if (stat.size !== initSize) {
      // size still changing; reschedule
      void stageWhenStable(absPath, fileName);
      return;
    }
    const id = `${stat.ino}-${stat.size}-${stat.mtimeMs}`;
    if (staged.has(id)) return;
    const ext = path.extname(fileName).toLowerCase();
    staged.set(id, {
      id,
      fileName,
      absPath,
      size: stat.size,
      detectedType: EXT_TO_TYPE[ext] ?? null,
      stagedAt: new Date(),
    });
    logger.info({ id, fileName }, "bookdrop: staged");
  }, 1000);
  stableTimers.set(absPath, timer);
}

export async function startBookdropWatcher(watchPath: string): Promise<void> {
  if (watcher) return; // already watching
  try {
    await fs.mkdir(watchPath, { recursive: true });
  } catch (e) {
    logger.warn({ err: e, watchPath }, "bookdrop: mkdir failed");
    return;
  }

  // Stage anything already present at startup.
  try {
    const entries = await fs.readdir(watchPath, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.isFile() && isSupported(ent.name)) {
        void stageWhenStable(path.join(watchPath, ent.name), ent.name);
      }
    }
  } catch (e) {
    logger.warn({ err: e, watchPath }, "bookdrop: initial readdir failed");
  }

  watcher = fsSync.watch(watchPath, { persistent: false }, (event, name) => {
    if (!name || typeof name !== "string") return;
    if (!isSupported(name)) return;
    const abs = path.join(watchPath, name);
    if (event === "rename") {
      // Rename includes both add and remove. Confirm existence.
      void fs.stat(abs).then(
        () => stageWhenStable(abs, name),
        () => {
          // File no longer exists — drop from staging if present.
          for (const [id, f] of staged) {
            if (f.absPath === abs) staged.delete(id);
          }
        },
      );
    } else if (event === "change") {
      void stageWhenStable(abs, name);
    }
  });
  logger.info({ watchPath }, "bookdrop: watching");
}

export function stopBookdropWatcher(): void {
  if (watcher) {
    watcher.close();
    watcher = null;
  }
  for (const t of stableTimers.values()) clearTimeout(t);
  stableTimers.clear();
}
