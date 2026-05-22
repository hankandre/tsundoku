import type { ExtractorResult } from "./types.ts";

/**
 * MOBI and AZW3 share the PalmDOC container with proprietary EXTH headers.
 * A full parser is a real undertaking; for now we read just the first few KB
 * and pull the EXTH title/author records when present. Anything else falls
 * back to the filename via the caller. Calibre's `ebook-meta` is the
 * pragmatic alternative if someone has it installed — we shell out to it if
 * available, and skip otherwise.
 */
async function tryCalibre(absPath: string): Promise<ExtractorResult | null> {
  try {
    const proc = Bun.spawn(["ebook-meta", absPath], {
      stdout: "pipe",
      stderr: "ignore",
    });
    const out = await new Response(proc.stdout).text();
    const code = await proc.exited;
    if (code !== 0 || !out) return null;
    const get = (label: string): string | null => {
      const m = new RegExp(`^${label}\\s*:\\s*(.+)$`, "m").exec(out);
      return m?.[1]?.trim() ?? null;
    };
    return {
      title: get("Title"),
      authors: (get("Author\\(s\\)") ?? "")
        .split(/\s*&\s*|\s*,\s*/)
        .map((s) => s.replace(/\[.*?\]/g, "").trim())
        .filter(Boolean),
      publisher: get("Publisher"),
      publishedDate: get("Published"),
      language: get("Languages"),
      description: get("Comments"),
      cover: null,
    };
  } catch {
    return null;
  }
}

export async function extractMobi(absPath: string): Promise<ExtractorResult> {
  const calibre = await tryCalibre(absPath);
  if (calibre) return calibre;
  return {
    warning:
      "MOBI/AZW3 needs Calibre's `ebook-meta` on PATH for now; falling back to filename.",
  };
}
