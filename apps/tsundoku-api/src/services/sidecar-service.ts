import { fail, assertIsDefined } from "../http/errors";

export interface SidecarMetadata {
  bookId: string;
  title: string | null;
  author: string | null;
  series: string | null;
  seriesNumber: number | null;
  genres: string[];
  tags: string[];
  description: string | null;
  publisher: string | null;
  publishedDate: string | null;
  isbn: string | null;
  language: string | null;
  custom: Record<string, unknown>;
}

export type SidecarSyncStatus = "SYNCED" | "OUT_OF_SYNC" | "FILE_MISSING" | "DB_MISSING";

export const getSidecarContent = async (_bookId: string): Promise<SidecarMetadata | null> => {
  fail(501, "Sidecar file operations require file system integration");
  return null;
};

export const getSyncStatus = async (_bookId: string): Promise<SidecarSyncStatus> => {
  fail(501, "Sidecar file operations require file system integration");
  return "FILE_MISSING";
};

export const exportToSidecar = async (_bookId: string): Promise<void> => {
  fail(501, "Sidecar file operations require file system integration");
};

export const importFromSidecar = async (_bookId: string): Promise<void> => {
  fail(501, "Sidecar file operations require file system integration");
};

export const bulkExport = async (_libraryId: string): Promise<number> => {
  fail(501, "Sidecar file operations require file system integration");
  return 0;
};

export const bulkImport = async (_libraryId: string): Promise<number> => {
  fail(501, "Sidecar file operations require file system integration");
  return 0;
};
