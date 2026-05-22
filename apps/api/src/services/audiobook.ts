import { parseFile } from "music-metadata";
import { resolveBookFile } from "./files.ts";
import { logger } from "../logger.ts";

export type AudiobookChapter = {
  index: number;
  title: string | null;
  startTimeSeconds: number;
  endTimeSeconds: number | null;
};

export type AudiobookSummary = {
  durationSeconds: number;
  trackCount: number;
  chapters: AudiobookChapter[];
};

/**
 * Read m4b/mp3 metadata via music-metadata. Returns chapters when the file
 * embeds them; otherwise a single chapter spanning the whole duration.
 */
export async function audiobookSummary(bookId: string): Promise<AudiobookSummary | null> {
  const resolved = await resolveBookFile(bookId);
  if (!resolved) return null;
  try {
    const meta = await parseFile(resolved.absolutePath, { duration: true });
    const duration = meta.format.duration ?? 0;
    // music-metadata exposes chapters on m4b files; mp3 chapter parsing varies.
    const rawChapters = (meta.format as { chapters?: Array<{ title?: string; start?: number; end?: number }> })
      .chapters;
    if (rawChapters?.length) {
      return {
        durationSeconds: duration,
        trackCount: rawChapters.length,
        chapters: rawChapters.map((ch, i) => ({
          index: i,
          title: ch.title ?? null,
          startTimeSeconds: ch.start ?? 0,
          endTimeSeconds: ch.end ?? null,
        })),
      };
    }
    return {
      durationSeconds: duration,
      trackCount: 1,
      chapters: [
        {
          index: 0,
          title: null,
          startTimeSeconds: 0,
          endTimeSeconds: duration,
        },
      ],
    };
  } catch (e) {
    logger.warn({ err: e, bookId }, "audiobookSummary failed");
    return null;
  }
}
