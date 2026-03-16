import { describe, expect, it, beforeAll, afterAll, beforeEach, jest } from "bun:test";
import { mkdtemp, rm, cp, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractEpubMetadata } from "../src/lib/epub/epub-metadata-extractor";
import { scanLibraryPathForBookFiles } from "../src/lib/filesystem/library-file-scanner";

const EPUB_FIXTURE = fileURLToPath(new URL("../../../Seneca - On the Shortness of Life (2004).epub", import.meta.url));

describe("EPUB metadata extraction", () => {
  it("extracts metadata from the fixture EPUB", async () => {
    const metadata = await extractEpubMetadata(EPUB_FIXTURE);

    expect(metadata.title).toBeDefined();
    expect(metadata.title).toContain("On the Shortness of Life");

    expect(metadata.authors).toBeDefined();
    expect(metadata.authors.length).toBeGreaterThan(0);

    expect(metadata.language).toBeDefined();
  });

  it("returns null for missing fields", async () => {
    const metadata = await extractEpubMetadata(EPUB_FIXTURE);

    expect(metadata.isbn10).toBeNull();
    expect(metadata.isbn13).not.toBeNull();
  });
});

describe("Library file scanner", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "tsundoku-test-"));
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("discovers EPUB files in a directory", async () => {
    const testEpub = path.join(tempDir, "Test Book.epub");
    await cp(EPUB_FIXTURE, testEpub);

    const files = await scanLibraryPathForBookFiles(tempDir);

    expect(files.length).toBe(1);
    expect(files[0].fileName).toBe("Test Book.epub");
    expect(files[0].extension).toBe(".epub");
  });

  it("recursively discovers EPUB files in subdirectories", async () => {
    const subDir = path.join(tempDir, "subfolder");
    await mkdir(subDir, { recursive: true });
    await writeFile(path.join(subDir, "test.txt"), "not an epub");

    const nestedEpub = path.join(subDir, "Nested Book.epub");
    await cp(EPUB_FIXTURE, nestedEpub);

    const files = await scanLibraryPathForBookFiles(tempDir);

    expect(files.length).toBe(2);
    const nestedFiles = files.filter((f) => f.fileName === "Nested Book.epub");
    expect(nestedFiles.length).toBe(1);
    expect(nestedFiles[0].fileSubPath).toBe("subfolder/Nested Book.epub");
  });

  it("ignores hidden files and temporary files", async () => {
    await writeFile(path.join(tempDir, ".hidden.epub"), "test");
    await writeFile(path.join(tempDir, "test.tmp"), "test");
    await writeFile(path.join(tempDir, "test.part"), "test");
    await writeFile(path.join(tempDir, "test.crdownload"), "test");

    const files = await scanLibraryPathForBookFiles(tempDir);

    const fileNames = files.map((f) => f.fileName);
    expect(fileNames).not.toContain(".hidden.epub");
    expect(fileNames).not.toContain("test.tmp");
    expect(fileNames).not.toContain("test.part");
    expect(fileNames).not.toContain("test.crdownload");
  });

  it("ignores non-epub files", async () => {
    await writeFile(path.join(tempDir, "test.pdf"), "test");
    await writeFile(path.join(tempDir, "test.mobi"), "test");
    await writeFile(path.join(tempDir, "test.txt"), "test");

    const files = await scanLibraryPathForBookFiles(tempDir);

    const extensions = files.map((f) => f.extension);
    expect(extensions.every((ext) => ext === ".epub")).toBe(true);
  });
});

describe("Library discovery integration", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "tsundoku-integration-"));
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("extracts metadata from discovered EPUB files", async () => {
    const testEpub = path.join(tempDir, "Seneca - On the Shortness of Life (2004).epub");
    await cp(EPUB_FIXTURE, testEpub);

    const files = await scanLibraryPathForBookFiles(tempDir);
    expect(files.length).toBe(1);

    const metadata = await extractEpubMetadata(files[0].absolutePath);
    expect(metadata.title).toBeTruthy();
    expect(metadata.authors).toBeTruthy();
  });
});
