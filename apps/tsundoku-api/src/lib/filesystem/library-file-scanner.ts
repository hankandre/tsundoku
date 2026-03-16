import { readdir } from "fs/promises";
import path from "path";

const SUPPORTED_BOOK_EXTENSIONS = new Set([".epub"]);
const IGNORED_DIRECTORY_NAMES = new Set(["$RECYCLE.BIN", ".caltrash"]);
const IGNORED_SUFFIXES = [
  ".part",
  ".tmp",
  ".crdownload",
  ".opdownload",
  ".download",
  ".swp",
  ".DS_Store",
];

export interface LibraryBookFile {
  absolutePath: string;
  fileName: string;
  fileSubPath: string;
  extension: string;
}

const shouldIgnoreName = (entryName: string): boolean => {
  if (entryName.startsWith(".")) {
    return true;
  }

  if (IGNORED_DIRECTORY_NAMES.has(entryName)) {
    return true;
  }

  const lowerName = entryName.toLowerCase();
  return IGNORED_SUFFIXES.some((suffix) => lowerName.endsWith(suffix));
};

const walkDirectory = async (directoryPath: string, files: string[]): Promise<void> => {
  const entries = await readdir(directoryPath, { withFileTypes: true });

  for (const entry of entries) {
    if (shouldIgnoreName(entry.name)) {
      continue;
    }

    const absolutePath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      await walkDirectory(absolutePath, files);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();
    if (!SUPPORTED_BOOK_EXTENSIONS.has(extension)) {
      continue;
    }

    files.push(absolutePath);
  }
};

export const scanLibraryPathForBookFiles = async (libraryPath: string): Promise<LibraryBookFile[]> => {
  const discoveredFiles: string[] = [];
  await walkDirectory(libraryPath, discoveredFiles);

  return discoveredFiles.map((absolutePath) => ({
    absolutePath,
    fileName: path.basename(absolutePath),
    fileSubPath: path.relative(libraryPath, absolutePath),
    extension: path.extname(absolutePath).toLowerCase(),
  }));
};
