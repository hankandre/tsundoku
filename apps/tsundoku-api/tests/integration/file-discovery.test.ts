import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractEpubMetadata } from "../../src/lib/epub/epub-metadata-extractor";
import { scanLibraryPathForBookFiles } from "../../src/lib/filesystem/library-file-scanner";
import { WatchEventBuffer } from "../../src/services/tasks/watch-event-buffer";

const EPUB_FIXTURE = fileURLToPath(
  new URL(
    "../../../../Seneca - On the Shortness of Life (2004).epub",
    import.meta.url,
  ),
);

const wait = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

describe("Integration: scanner + metadata", () => {
  let tempDir = "";

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "tsundoku-integration-"));
  });

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = "";
    }
  });

  it("discovers nested epub files and extracts metadata", async () => {
    const nestedDir = path.join(tempDir, "nested", "deeper");
    await mkdir(nestedDir, { recursive: true });
    await cp(EPUB_FIXTURE, path.join(nestedDir, "Nested Book.epub"));
    await writeFile(path.join(tempDir, "ignore.txt"), "not an epub");

    const discoveredFiles = await scanLibraryPathForBookFiles(tempDir);
    expect(discoveredFiles).toHaveLength(1);
    expect(discoveredFiles[0].fileSubPath).toBe(
      "nested/deeper/Nested Book.epub",
    );

    const metadata = await extractEpubMetadata(discoveredFiles[0].absolutePath);
    expect(metadata.title).toContain("On the Shortness of Life");
    expect(metadata.authors).toContain("Seneca");
    expect(metadata.language).toMatch(/^en/);
  });

  it("discovers malformed .epub files while metadata extraction fails", async () => {
    const malformedPath = path.join(tempDir, "broken.epub");
    await writeFile(malformedPath, "not a real epub");

    const discoveredFiles = await scanLibraryPathForBookFiles(tempDir);
    expect(discoveredFiles).toHaveLength(1);
    expect(discoveredFiles[0].fileName).toBe("broken.epub");

    expect(extractEpubMetadata(malformedPath)).rejects.toThrow();
  });
});

describe("Integration: watch buffer + scanner", () => {
  let tempDir = "";
  let buffer: WatchEventBuffer | null = null;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "tsundoku-watch-"));
    buffer = new WatchEventBuffer();
  });

  afterEach(async () => {
    if (buffer) {
      buffer.dispose();
      buffer = null;
    }

    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = "";
    }
  });

  it("coalesces rapid re-schedules for the same key", async () => {
    let callbackRuns = 0;
    let discoveredCount = 0;
    const key = `scan:${tempDir}`;

    if (!buffer) {
      throw new Error("WatchEventBuffer was not initialized");
    }

    await cp(EPUB_FIXTURE, path.join(tempDir, "Book1.epub"));
    buffer.schedule(key, 100, async () => {
      callbackRuns += 1;
      const files = await scanLibraryPathForBookFiles(tempDir);
      discoveredCount = files.length;
    });

    await cp(EPUB_FIXTURE, path.join(tempDir, "Book2.epub"));
    buffer.schedule(key, 100, async () => {
      callbackRuns += 1;
      const files = await scanLibraryPathForBookFiles(tempDir);
      discoveredCount = files.length;
    });

    await cp(EPUB_FIXTURE, path.join(tempDir, "Book3.epub"));
    buffer.schedule(key, 100, async () => {
      callbackRuns += 1;
      const files = await scanLibraryPathForBookFiles(tempDir);
      discoveredCount = files.length;
    });

    await wait(220);

    expect(callbackRuns).toBe(1);
    expect(discoveredCount).toBe(3);
  });
});
