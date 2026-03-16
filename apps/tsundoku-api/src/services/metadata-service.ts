import { db, schema } from "../db/client";
import { eq, and, inArray } from "drizzle-orm";
import { fail, assertIsDefined } from "../http/errors";

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
  allFieldsLocked: boolean | null;
  titleLocked: boolean | null;
  authorsLocked: boolean | null;
  categoriesLocked: boolean | null;
  subtitleLocked: boolean | null;
  publisherLocked: boolean | null;
  publishedDateLocked: boolean | null;
  descriptionLocked: boolean | null;
  isbn13Locked: boolean | null;
  isbn10Locked: boolean | null;
  pageCountLocked: boolean | null;
  thumbnailLocked: boolean | null;
  languageLocked: boolean | null;
  coverLocked: boolean | null;
  ratingLocked: boolean | null;
  reviewCountLocked: boolean | null;
  seriesNameLocked: boolean | null;
  seriesNumberLocked: boolean | null;
  seriesTotalLocked: boolean | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface BookMetadataWithAuthors {
  metadata: BookMetadataRow;
  authors: Array<{ id: string; name: string | null }>;
  categories: Array<{ id: string; name: string | null }>;
}

export const getBookMetadataById = async (bookId: string): Promise<BookMetadataRow | undefined> => {
  assertIsDefined(db, "Database not configured");
  const result = await db.select().from(schema.bookMetadata).where(eq(schema.bookMetadata.bookId, bookId));
  return result[0];
};

export const getBookMetadataWithRelations = async (bookId: string): Promise<BookMetadataWithAuthors | undefined> => {
  assertIsDefined(db, "Database not configured");
  
  const metadata = await db.select().from(schema.bookMetadata).where(eq(schema.bookMetadata.bookId, bookId));
  if (!metadata[0]) return undefined;
  
  const authorRows = await db
    .select({
      id: schema.authors.id,
      name: schema.authors.name,
    })
    .from(schema.authors)
    .innerJoin(schema.bookMetadataAuthorMapping, eq(schema.authors.id, schema.bookMetadataAuthorMapping.authorId))
    .where(eq(schema.bookMetadataAuthorMapping.bookId, bookId));
  
  const categoryRows = await db
    .select({
      id: schema.categories.id,
      name: schema.categories.name,
    })
    .from(schema.categories)
    .innerJoin(schema.bookMetadataCategoryMapping, eq(schema.categories.id, schema.bookMetadataCategoryMapping.categoryId))
    .where(eq(schema.bookMetadataCategoryMapping.bookId, bookId));
  
  return {
    metadata: metadata[0],
    authors: authorRows,
    categories: categoryRows,
  };
};

export interface UpdateMetadataInput {
  title?: string | null;
  subtitle?: string | null;
  publisher?: string | null;
  publishedDate?: string | null;
  description?: string | null;
  isbn13?: string | null;
  isbn10?: string | null;
  pageCount?: number | null;
  thumbnail?: string | null;
  language?: string | null;
  rating?: number | null;
  cover?: string | null;
  seriesName?: string | null;
  seriesNumber?: number | null;
  seriesTotal?: number | null;
  authorIds?: string[];
  categoryIds?: string[];
}

export const updateBookMetadata = async (
  bookId: string,
  input: UpdateMetadataInput,
  mergeCategories: boolean = false
): Promise<BookMetadataRow> => {
  assertIsDefined(db, "Database not configured");
  
  const existing = await getBookMetadataById(bookId);
  if (!existing) {
    fail(404, `Book metadata not found for book: ${bookId}`);
  }
  
  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };
  
  if (input.title !== undefined) updateData.title = input.title;
  if (input.subtitle !== undefined) updateData.subtitle = input.subtitle;
  if (input.publisher !== undefined) updateData.publisher = input.publisher;
  if (input.publishedDate !== undefined) updateData.publishedDate = input.publishedDate;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.isbn13 !== undefined) updateData.isbn13 = input.isbn13;
  if (input.isbn10 !== undefined) updateData.isbn10 = input.isbn10;
  if (input.pageCount !== undefined) updateData.pageCount = input.pageCount;
  if (input.thumbnail !== undefined) updateData.thumbnail = input.thumbnail;
  if (input.language !== undefined) updateData.language = input.language;
  if (input.rating !== undefined) updateData.rating = input.rating;
  if (input.cover !== undefined) updateData.cover = input.cover;
  if (input.seriesName !== undefined) updateData.seriesName = input.seriesName;
  if (input.seriesNumber !== undefined) updateData.seriesNumber = input.seriesNumber;
  if (input.seriesTotal !== undefined) updateData.seriesTotal = input.seriesTotal;
  
  if (input.authorIds !== undefined) {
    await db.delete(schema.bookMetadataAuthorMapping).where(eq(schema.bookMetadataAuthorMapping.bookId, bookId));
    for (const authorId of input.authorIds) {
      await db.insert(schema.bookMetadataAuthorMapping).values({ bookId, authorId });
    }
  }
  
  if (input.categoryIds !== undefined) {
    if (!mergeCategories) {
      await db.delete(schema.bookMetadataCategoryMapping).where(eq(schema.bookMetadataCategoryMapping.bookId, bookId));
    }
    for (const categoryId of input.categoryIds) {
      await db.insert(schema.bookMetadataCategoryMapping).values({ bookId, categoryId }).onConflictDoNothing();
    }
  }
  
  await db.update(schema.bookMetadata).set(updateData).where(eq(schema.bookMetadata.bookId, bookId));
  
  const updated = await getBookMetadataById(bookId);
  return updated!;
};

export interface BulkMetadataUpdateInput {
  bookIds: string[];
  metadata: UpdateMetadataInput;
  mergeCategories?: boolean;
  mergeMoods?: boolean;
  mergeTags?: boolean;
}

export const bulkUpdateMetadata = async (input: BulkMetadataUpdateInput): Promise<void> => {
  assertIsDefined(db, "Database not configured");
  
  for (const bookId of input.bookIds) {
    await updateBookMetadata(bookId, input.metadata, input.mergeCategories ?? false);
  }
};

export interface ToggleAllLockInput {
  bookIds: string[];
  lock: boolean;
}

export const toggleAllMetadataLock = async (input: ToggleAllLockInput): Promise<BookMetadataRow[]> => {
  assertIsDefined(db, "Database not configured");
  
  await db
    .update(schema.bookMetadata)
    .set({ 
      allFieldsLocked: input.lock,
      titleLocked: input.lock,
      authorsLocked: input.lock,
      categoriesLocked: input.lock,
      subtitleLocked: input.lock,
      publisherLocked: input.lock,
      publishedDateLocked: input.lock,
      descriptionLocked: input.lock,
      isbn13Locked: input.lock,
      isbn10Locked: input.lock,
      pageCountLocked: input.lock,
      thumbnailLocked: input.lock,
      languageLocked: input.lock,
      coverLocked: input.lock,
      ratingLocked: input.lock,
      reviewCountLocked: input.lock,
      seriesNameLocked: input.lock,
      seriesNumberLocked: input.lock,
      seriesTotalLocked: input.lock,
      updatedAt: new Date(),
    })
    .where(inArray(schema.bookMetadata.bookId, input.bookIds));
  
  const results = await db.select().from(schema.bookMetadata).where(inArray(schema.bookMetadata.bookId, input.bookIds));
  return results;
};

export interface FieldLockAction {
  field: string;
  lock: boolean;
}

export interface ToggleFieldLocksInput {
  bookIds: string[];
  fieldActions: FieldLockAction[];
}

export const toggleFieldLocks = async (input: ToggleFieldLocksInput): Promise<void> => {
  assertIsDefined(db, "Database not configured");
  
  const fieldToColumn: Record<string, string> = {
    TITLE: "titleLocked",
    SUBTITLE: "subtitleLocked",
    PUBLISHER: "publisherLocked",
    PUBLISHED_DATE: "publishedDateLocked",
    DESCRIPTION: "descriptionLocked",
    ISBN13: "isbn13Locked",
    ISBN10: "isbn10Locked",
    PAGE_COUNT: "pageCountLocked",
    THUMBNAIL: "thumbnailLocked",
    LANGUAGE: "languageLocked",
    COVER: "coverLocked",
    RATING: "ratingLocked",
    REVIEW_COUNT: "reviewCountLocked",
    SERIES_NAME: "seriesNameLocked",
    SERIES_NUMBER: "seriesNumberLocked",
    SERIES_TOTAL: "seriesTotalLocked",
  };
  
  for (const bookId of input.bookIds) {
    const updateData: Record<string, boolean | Date> = { updatedAt: new Date() };
    
    for (const action of input.fieldActions) {
      const column = fieldToColumn[action.field];
      if (column) {
        updateData[column] = action.lock;
      }
    }
    
    await db.update(schema.bookMetadata).set(updateData).where(eq(schema.bookMetadata.bookId, bookId));
  }
};

export const lookupByIsbn = async (isbn: string): Promise<BookMetadataWithAuthors | null> => {
  fail(501, "ISBN lookup requires external metadata provider integration");
  return null;
};

export const getDetailedProviderMetadata = async (provider: string, providerItemId: string): Promise<BookMetadataRow | null> => {
  fail(501, "Provider metadata lookup requires external metadata provider integration");
  return null;
};

export const getOrCreateAuthor = async (name: string, userId?: string): Promise<string> => {
  assertIsDefined(db, "Database not configured");
  
  const existing = await db.select().from(schema.authors).where(eq(schema.authors.name, name)).limit(1);
  if (existing[0]) {
    return existing[0].id;
  }
  
  const authorId = Bun.randomUUIDv7();
  await db.insert(schema.authors).values({
    id: authorId,
    name,
    createdBy: userId,
  });
  
  return authorId;
};

export const getOrCreateCategory = async (name: string, userId?: string): Promise<string> => {
  assertIsDefined(db, "Database not configured");
  
  const existing = await db.select().from(schema.categories).where(eq(schema.categories.name, name)).limit(1);
  if (existing[0]) {
    return existing[0].id;
  }
  
  const categoryId = Bun.randomUUIDv7();
  await db.insert(schema.categories).values({
    id: categoryId,
    name,
    createdBy: userId,
  });
  
  return categoryId;
};
