import { db, schema } from "../db/client";
import { eq, and, inArray } from "drizzle-orm";
import { fail, assertIsDefined } from "../http/errors";
import { resolve } from "node:path";

export interface BookRow {
  id: string;
  fileName: string;
  fileSubPath: string;
  bookType: string;
  isPhysical: boolean;
  libraryId: string;
  libraryPathId: string;
  createdAt: Date;
  updatedAt: Date | null;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface BookMetadataRow {
  bookId: string;
  title: string | null;
  subtitle: string | null;
  publisher: string | null;
  publishedDate: string | null;
  description: string | null;
  isbn13: string | null;
  isbn10: string | null;
  pageCount: number | null;
  thumbnail: string | null;
  language: string | null;
  rating: number | null;
  reviewCount: number | null;
  cover: string | null;
  coverUpdatedOn: Date | null;
  seriesName: string | null;
  seriesNumber: number | null;
  seriesTotal: number | null;
}

export const getAllBooks = async (): Promise<BookRow[]> => {
  assertIsDefined(db, "Database not configured");
  return await db.select().from(schema.books);
};

export const getBookById = async (id: string): Promise<BookRow | undefined> => {
  assertIsDefined(db, "Database not configured");
  const result = await db.select().from(schema.books).where(eq(schema.books.id, id));
  return result[0];
};

export const updateBookPhysicalFlag = async (
  bookId: string,
  physical: boolean,
  updatedBy: string,
): Promise<BookRow> => {
  assertIsDefined(db, "Database not configured");

  const result = await db
    .update(schema.books)
    .set({
      isPhysical: physical,
      updatedAt: new Date(),
      updatedBy,
    })
    .where(eq(schema.books.id, bookId))
    .returning();

  const updatedBook = result[0];
  if (!updatedBook) {
    fail(404, `Book not found: ${bookId}`);
  }

  return updatedBook;
};

export const getBooksByIds = async (ids: string[]): Promise<BookRow[]> => {
  assertIsDefined(db, "Database not configured");
  return await db.select().from(schema.books).where(inArray(schema.books.id, ids));
};

export const getBooksByLibraryId = async (libraryId: string): Promise<BookRow[]> => {
  assertIsDefined(db, "Database not configured");
  return await db.select().from(schema.books).where(eq(schema.books.libraryId, libraryId));
};

export const getBooksByLibraryIdWithFilters = async (
  libraryId: string,
  options: { limit?: number; offset?: number; format?: string }
): Promise<BookRow[]> => {
  assertIsDefined(db, "Database not configured");
  
  const conditions = [eq(schema.books.libraryId, libraryId)];
  
  if (options.format) {
    conditions.push(eq(schema.books.bookType, options.format));
  }

  let query = db
    .select()
    .from(schema.books)
    .where(and(...conditions));

  if (options.limit) {
    query = query.limit(options.limit);
  }
  if (options.offset) {
    query = query.offset(options.offset);
  }

  return await query;
};

export const getBookByLibraryAndId = async (
  libraryId: string,
  bookId: string
): Promise<BookRow | undefined> => {
  assertIsDefined(db, "Database not configured");
  const result = await db
    .select()
    .from(schema.books)
    .where(
      and(
        eq(schema.books.id, bookId),
        eq(schema.books.libraryId, libraryId)
      )
    );
  return result[0];
};

export interface FormatCounts {
  epub: number;
  pdf: number;
  [key: string]: number;
}

export const getFormatCountsForLibrary = async (libraryId: string): Promise<FormatCounts> => {
  assertIsDefined(db, "Database not configured");
  
  const books = await db
    .select({ bookType: schema.books.bookType })
    .from(schema.books)
    .where(eq(schema.books.libraryId, libraryId));

  const counts: FormatCounts = {
    epub: 0,
    pdf: 0,
  };

  for (const book of books) {
    const type = book.bookType.toLowerCase();
    if (counts[type] !== undefined) {
      counts[type]++;
    } else {
      counts[type] = 1;
    }
  }

  return counts;
};

export const getBookMetadata = async (bookId: string): Promise<BookMetadataRow | undefined> => {
  assertIsDefined(db, "Database not configured");
  const result = await db.select().from(schema.bookMetadata).where(eq(schema.bookMetadata.bookId, bookId));
  return result[0];
};

export const checkBookAccess = async (
  bookId: string,
  userId: string,
  isAdmin: boolean
): Promise<boolean> => {
  assertIsDefined(db, "Database not configured");
  if (isAdmin) return true;

  const book = await getBookById(bookId);
  if (!book) return false;

  const userLibraryResult = await db
    .select()
    .from(schema.userLibraryMapping)
    .where(and(
      eq(schema.userLibraryMapping.userId, userId),
      eq(schema.userLibraryMapping.libraryId, book.libraryId)
    ));

  return userLibraryResult.length > 0;
};

export { schema };

export interface BookFileLocation {
  filePath: string;
  fileName: string;
  bookType: string;
}

type EbookViewerSettings = {
  fontFamily?: string | null;
  fontSize?: number | null;
  gap?: number | null;
  hyphenate?: boolean | null;
  isDark?: boolean | null;
  justify?: boolean | null;
  lineHeight?: number | null;
  maxBlockSize?: number | null;
  maxColumnCount?: number | null;
  maxInlineSize?: number | null;
  theme?: string | null;
  flow?: string | null;
};

type NewPdfViewerSettings = {
  spread?: string | null;
  viewMode?: string | null;
};

type CbxViewerSettings = {
  backgroundColor?: string | null;
};

export interface BookViewerSettings {
  ebookSettings?: EbookViewerSettings;
  newPdfSettings?: NewPdfViewerSettings;
  cbxSettings?: CbxViewerSettings;
}

export const getPrimaryBookFileLocation = async (
  bookId: string,
): Promise<BookFileLocation> => {
  assertIsDefined(db, "Database not configured");

  const rows = await db
    .select({
      fileName: schema.books.fileName,
      fileSubPath: schema.books.fileSubPath,
      bookType: schema.books.bookType,
      libraryRootPath: schema.libraryPath.path,
    })
    .from(schema.books)
    .innerJoin(
      schema.libraryPath,
      eq(schema.books.libraryPathId, schema.libraryPath.id),
    )
    .where(eq(schema.books.id, bookId))
    .limit(1);

  const fileRecord = rows[0];
  if (!fileRecord) {
    fail(404, `Book not found: ${bookId}`);
  }

  if (!fileRecord.libraryRootPath) {
    fail(400, `Library path is not configured for book: ${bookId}`);
  }

  const filePath = resolve(fileRecord.libraryRootPath, fileRecord.fileSubPath);

  return {
    filePath,
    fileName: fileRecord.fileName,
    bookType: fileRecord.bookType,
  };
};

export const getViewerSettingsForUserBook = async (
  userId: string,
  bookId: string,
  bookType: string,
): Promise<BookViewerSettings> => {
  assertIsDefined(db, "Database not configured");

  const normalizedBookType = bookType.toLowerCase();

  if (["epub", "fb2", "mobi", "azw3"].includes(normalizedBookType)) {
    const existingPreferences = await db
      .select()
      .from(schema.ebookViewerPreference)
      .where(
        and(
          eq(schema.ebookViewerPreference.userId, userId),
          eq(schema.ebookViewerPreference.bookId, bookId),
        ),
      )
      .limit(1);

    const ebookPreference = existingPreferences[0];
    if (!ebookPreference) {
      return {};
    }

    return {
      ebookSettings: {
        fontFamily: ebookPreference.fontFamily,
        fontSize: ebookPreference.fontSize,
        gap: ebookPreference.gap,
        hyphenate: ebookPreference.hyphenate,
        isDark: ebookPreference.isDark,
        justify: ebookPreference.justify,
        lineHeight: ebookPreference.lineHeight,
        maxBlockSize: ebookPreference.maxBlockSize,
        maxColumnCount: ebookPreference.maxColumnCount,
        maxInlineSize: ebookPreference.maxInlineSize,
        theme: ebookPreference.theme,
        flow: ebookPreference.flow,
      },
    };
  }

  if (normalizedBookType === "pdf") {
    const existingPreferences = await db
      .select()
      .from(schema.newPdfViewerPreference)
      .where(
        and(
          eq(schema.newPdfViewerPreference.userId, userId),
          eq(schema.newPdfViewerPreference.bookId, bookId),
        ),
      )
      .limit(1);

    const newPdfPreference = existingPreferences[0];
    if (!newPdfPreference) {
      return {};
    }

    return {
      newPdfSettings: {
        spread: newPdfPreference.spread,
        viewMode: newPdfPreference.viewMode,
      },
    };
  }

  if (normalizedBookType === "cbx") {
    const existingPreferences = await db
      .select()
      .from(schema.cbxViewerPreference)
      .where(
        and(
          eq(schema.cbxViewerPreference.userId, userId),
          eq(schema.cbxViewerPreference.bookId, bookId),
        ),
      )
      .limit(1);

    const cbxPreference = existingPreferences[0];
    if (!cbxPreference) {
      return {};
    }

    return {
      cbxSettings: {
        backgroundColor: cbxPreference.backgroundColor,
      },
    };
  }

  return {};
};

export const updateViewerSettingsForUserBook = async (
  userId: string,
  bookId: string,
  bookType: string,
  settings: BookViewerSettings,
): Promise<void> => {
  assertIsDefined(db, "Database not configured");

  const normalizedBookType = bookType.toLowerCase();

  if (["epub", "fb2", "mobi", "azw3"].includes(normalizedBookType)) {
    const ebookSettings = settings.ebookSettings;
    if (!ebookSettings) {
      fail(400, "ebookSettings is required for ebook formats");
    }

    const existingPreferences = await db
      .select({ id: schema.ebookViewerPreference.id })
      .from(schema.ebookViewerPreference)
      .where(
        and(
          eq(schema.ebookViewerPreference.userId, userId),
          eq(schema.ebookViewerPreference.bookId, bookId),
        ),
      )
      .limit(1);

    const commonValues = {
      fontFamily: ebookSettings.fontFamily ?? null,
      fontSize: ebookSettings.fontSize ?? null,
      gap: ebookSettings.gap ?? null,
      hyphenate: ebookSettings.hyphenate ?? null,
      isDark: ebookSettings.isDark ?? null,
      justify: ebookSettings.justify ?? null,
      lineHeight: ebookSettings.lineHeight ?? null,
      maxBlockSize: ebookSettings.maxBlockSize ?? null,
      maxColumnCount: ebookSettings.maxColumnCount ?? null,
      maxInlineSize: ebookSettings.maxInlineSize ?? null,
      theme: ebookSettings.theme ?? null,
      flow: ebookSettings.flow ?? null,
      updatedAt: new Date(),
      updatedBy: userId,
    };

    if (existingPreferences[0]) {
      await db
        .update(schema.ebookViewerPreference)
        .set(commonValues)
        .where(eq(schema.ebookViewerPreference.id, existingPreferences[0].id));
      return;
    }

    await db.insert(schema.ebookViewerPreference).values({
      userId,
      bookId,
      ...commonValues,
      createdBy: userId,
    });
    return;
  }

  if (normalizedBookType === "pdf") {
    const newPdfSettings = settings.newPdfSettings;
    if (!newPdfSettings) {
      fail(400, "newPdfSettings is required for pdf format");
    }

    const existingPreferences = await db
      .select({ id: schema.newPdfViewerPreference.id })
      .from(schema.newPdfViewerPreference)
      .where(
        and(
          eq(schema.newPdfViewerPreference.userId, userId),
          eq(schema.newPdfViewerPreference.bookId, bookId),
        ),
      )
      .limit(1);

    const commonValues = {
      spread: newPdfSettings.spread ?? null,
      viewMode: newPdfSettings.viewMode ?? null,
      updatedAt: new Date(),
      updatedBy: userId,
    };

    if (existingPreferences[0]) {
      await db
        .update(schema.newPdfViewerPreference)
        .set(commonValues)
        .where(eq(schema.newPdfViewerPreference.id, existingPreferences[0].id));
      return;
    }

    await db.insert(schema.newPdfViewerPreference).values({
      userId,
      bookId,
      ...commonValues,
      createdBy: userId,
    });
    return;
  }

  if (normalizedBookType === "cbx") {
    const cbxSettings = settings.cbxSettings;
    if (!cbxSettings) {
      fail(400, "cbxSettings is required for cbx format");
    }

    const existingPreferences = await db
      .select({ id: schema.cbxViewerPreference.id })
      .from(schema.cbxViewerPreference)
      .where(
        and(
          eq(schema.cbxViewerPreference.userId, userId),
          eq(schema.cbxViewerPreference.bookId, bookId),
        ),
      )
      .limit(1);

    const commonValues = {
      backgroundColor: cbxSettings.backgroundColor ?? null,
      updatedAt: new Date(),
      updatedBy: userId,
    };

    if (existingPreferences[0]) {
      await db
        .update(schema.cbxViewerPreference)
        .set(commonValues)
        .where(eq(schema.cbxViewerPreference.id, existingPreferences[0].id));
      return;
    }

    await db.insert(schema.cbxViewerPreference).values({
      userId,
      bookId,
      ...commonValues,
      createdBy: userId,
    });
  }
};
