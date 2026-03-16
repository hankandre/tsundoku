import { db, schema } from "../db/client";
import { eq } from "drizzle-orm";
import { fail, assertIsDefined } from "../http/errors";

const ensureDb = () => {
  if (!db) {
    throw new Error("Database not configured");
  }
  return db;
};

export interface SvgIcon {
  name: string;
  content: string;
}

export interface SvgIconBatchItem {
  name: string;
  content: string;
}

export interface SvgIconBatchResponse {
  success: number;
  failed: number;
  errors: Array<{ name: string; error: string }>;
}

export const saveSvgIcon = async (_name: string, _content: string): Promise<void> => {
  fail(501, "Icon storage requires file system integration");
};

export const saveBatchSvgIcons = async (
  _icons: SvgIconBatchItem[]
): Promise<SvgIconBatchResponse> => {
  fail(501, "Icon storage requires file system integration");
  return { success: 0, failed: 0, errors: [] };
};

export const getSvgIcon = async (_svgName: string): Promise<string | null> => {
  fail(501, "Icon storage requires file system integration");
  return null;
};

export const getIconNames = async (
  page: number = 0,
  size: number = 50
): Promise<{ content: string[]; totalElements: number; totalPages: number }> => {
  return {
    content: [],
    totalElements: 0,
    totalPages: 0,
  };
};

export const deleteSvgIcon = async (_svgName: string): Promise<void> => {
  fail(501, "Icon storage requires file system integration");
};

export const getAllIconsContent = async (): Promise<Record<string, string>> => {
  fail(501, "Icon storage requires file system integration");
  return {};
};
