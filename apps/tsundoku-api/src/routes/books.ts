import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppVariables, AuthUser } from "../types/app-variables";
import { fail, handleValidationError, assertIsDefined } from "../http/errors";
import { requireAdmin } from "../middleware/auth-middleware";
import {
  getAllBooks,
  getBookById,
  getBooksByIds,
  checkBookAccess,
  getBookByLibraryAndId,
  getPrimaryBookFileLocation,
  getViewerSettingsForUserBook,
  updateViewerSettingsForUserBook,
  updateBookPhysicalFlag,
  type BookRow,
} from "../services/book-service";
import {
  assignBooksToShelves,
  unassignBooksFromShelves,
} from "../services/shelf-service";
import {
  updateUserBookProgress,
  updateUserBookStatus,
  resetUserBookProgress,
  updatePersonalRating,
  resetPersonalRating,
} from "../services/user-progress-service";
import {
  getBookMetadataById,
  getBookMetadataWithRelations,
  updateBookMetadata,
  bulkUpdateMetadata,
  toggleAllMetadataLock,
  toggleFieldLocks,
  lookupByIsbn,
  getDetailedProviderMetadata,
} from "../services/metadata-service";

const getAuthUser = (c: import("hono").Context): AuthUser => {
  const authUser = c.get("authUser");
  if (!authUser) {
    fail(401, "Unauthorized");
  }
  return authUser as AuthUser;
};

const idsQuerySchema = z.object({
  ids: z.string(),
});

const bookListQuerySchema = z.object({
  withDescription: z.boolean().optional(),
});

const bookIdSchema = z.object({
  bookId: z.uuidv7(),
});

const progressSchema = z.object({
  bookId: z.string(),
  progress: z.number(),
});

const shelvesAssignmentSchema = z.object({
  bookIds: z.array(z.string()),
  shelvesToAssign: z.array(z.string()).optional(),
  shelvesToUnassign: z.array(z.string()).optional(),
});

const assignShelvesSchema = z.object({
  bookIds: z.array(z.string()),
  shelvesToAssign: z.array(z.string()).optional(),
});

const readStatusSchema = z.object({
  bookIds: z.array(z.string()),
  status: z.enum(["READING", "COMPLETED", "DROPPED", "ON_HOLD", "PLAN_TO_READ"]),
});

const ratingSchema = z.object({
  ids: z.array(z.string()),
  rating: z.number().min(0).max(5),
});

const metadataUpdateSchema = z.object({
  title: z.string().optional(),
  subtitle: z.string().optional(),
  publisher: z.string().optional(),
  publishedDate: z.string().optional(),
  description: z.string().optional(),
  isbn13: z.string().optional(),
  isbn10: z.string().optional(),
  pageCount: z.number().optional(),
  thumbnail: z.string().optional(),
  language: z.string().optional(),
  rating: z.number().optional(),
  cover: z.string().optional(),
  seriesName: z.string().optional(),
  seriesNumber: z.number().optional(),
  seriesTotal: z.number().optional(),
  authorIds: z.array(z.string()).optional(),
  categoryIds: z.array(z.string()).optional(),
});

const bulkMetadataUpdateSchema = z.object({
  bookIds: z.array(z.string()),
  metadata: metadataUpdateSchema,
  mergeCategories: z.boolean().optional(),
  mergeMoods: z.boolean().optional(),
  mergeTags: z.boolean().optional(),
});

const toggleAllLockSchema = z.object({
  bookIds: z.array(z.string()),
  lock: z.boolean(),
});

const toggleFieldLocksSchema = z.object({
  bookIds: z.array(z.string()),
  fieldActions: z.array(z.object({
    field: z.enum([
      "TITLE", "SUBTITLE", "PUBLISHER", "PUBLISHED_DATE", "DESCRIPTION",
      "ISBN13", "ISBN10", "PAGE_COUNT", "THUMBNAIL", "LANGUAGE",
      "COVER", "RATING", "REVIEW_COUNT", "SERIES_NAME", "SERIES_NUMBER", "SERIES_TOTAL"
    ]),
    lock: z.boolean(),
  })),
});

const isbnLookupSchema = z.object({
  isbn: z.string(),
});

const bookIdParamSchema = z.object({
  bookId: z.uuidv7(),
});

const togglePhysicalQuerySchema = z.object({
  physical: z.enum(["true", "false"]).transform((value) => value === "true"),
});

const ebookViewerSettingsSchema = z.object({
  fontFamily: z.string().optional(),
  fontSize: z.number().optional(),
  gap: z.number().optional(),
  hyphenate: z.boolean().optional(),
  isDark: z.boolean().optional(),
  justify: z.boolean().optional(),
  lineHeight: z.number().optional(),
  maxBlockSize: z.number().optional(),
  maxColumnCount: z.number().optional(),
  maxInlineSize: z.number().optional(),
  theme: z.string().optional(),
  flow: z.string().optional(),
});

const newPdfViewerSettingsSchema = z.object({
  spread: z.string().optional(),
  viewMode: z.string().optional(),
});

const cbxViewerSettingsSchema = z.object({
  backgroundColor: z.string().optional(),
});

const updateViewerSettingsSchema = z.object({
  ebookSettings: ebookViewerSettingsSchema.optional(),
  newPdfSettings: newPdfViewerSettingsSchema.optional(),
  cbxSettings: cbxViewerSettingsSchema.optional(),
});

const validateBookId = zValidator("param", bookIdParamSchema, handleValidationError);

const getContentTypeForBookType = (bookType: string): string => {
  const normalizedBookType = bookType.toLowerCase();

  if (normalizedBookType === "epub") {
    return "application/epub+zip";
  }

  if (normalizedBookType === "pdf") {
    return "application/pdf";
  }

  if (normalizedBookType === "cbx") {
    return "application/x-cbr";
  }

  return "application/octet-stream";
};

export const bookRoutes = new Hono<{ Variables: AppVariables }>();

bookRoutes.get("/", zValidator("query", bookListQuerySchema, handleValidationError), async (c) => {
  const authUser = getAuthUser(c);
  const { withDescription } = c.req.valid("query");

  const books = await getAllBooks();

  const results = books.map((book: BookRow) => ({
    id: book.id,
    fileName: book.fileName,
    bookType: book.bookType,
    libraryId: book.libraryId,
  }));

  return c.json(results, 200);
});

bookRoutes.get("/batch", zValidator("query", idsQuerySchema, handleValidationError), async (c) => {
  const { ids } = c.req.valid("query");
  const idList = ids.split(",");

  const books = await getBooksByIds(idList);

  return c.json(books, 200);
});

bookRoutes.get("/metadata/detail/:provider/:providerItemId", async (c) => {
  const provider = c.req.param("provider");
  const providerItemId = c.req.param("providerItemId");
  
  const result = await getDetailedProviderMetadata(provider, providerItemId);
  if (!result) {
    return c.body(null, 404);
  }
  return c.json(result, 200);
});

bookRoutes.post("/metadata/isbn-lookup", zValidator("json", isbnLookupSchema, handleValidationError), async (c) => {
  const input = c.req.valid("json");
  const result = await lookupByIsbn(input.isbn);
  if (!result) {
    return c.body(null, 404);
  }
  return c.json(result, 200);
});

bookRoutes.put("/metadata/toggle-all-lock", zValidator("json", toggleAllLockSchema, handleValidationError), async (c) => {
  const input = c.req.valid("json");
  const results = await toggleAllMetadataLock(input);
  return c.json(results, 200);
});

bookRoutes.put("/metadata/toggle-field-locks", zValidator("json", toggleFieldLocksSchema, handleValidationError), async (c) => {
  const input = c.req.valid("json");
  await toggleFieldLocks(input);
  return c.body(null, 200);
});

bookRoutes.put("/bulk-edit-metadata", zValidator("json", bulkMetadataUpdateSchema, handleValidationError), async (c) => {
  const authUser = getAuthUser(c);

  const input = c.req.valid("json");
  await bulkUpdateMetadata(input);

  return c.body(null, 204);
});

bookRoutes.post("/metadata/recalculate-match-scores", requireAdmin, async (c) => {
  fail(501, "Recalculate match scores requires metadata matching service");
});

bookRoutes.post("/metadata/manage/consolidate", requireAdmin, async (c) => {
  fail(501, "Consolidate metadata requires admin metadata management service");
});

bookRoutes.post("/metadata/manage/delete", requireAdmin, async (c) => {
  fail(501, "Delete metadata requires admin metadata management service");
});

bookRoutes.get("/:bookId", validateBookId, async (c) => {
  const authUser = getAuthUser(c);
  const { bookId } = c.req.valid("param");

  const hasAccess = await checkBookAccess(bookId, authUser.userId, authUser.isAdmin);
  if (!hasAccess) {
    fail(403, "Access denied to this book");
  }

  const book = await getBookById(bookId);
  if (!book) {
    fail(404, `Book not found: ${bookId}`);
  }

  return c.json(book, 200);
});

bookRoutes.post("/shelves", zValidator("json", assignShelvesSchema, handleValidationError), async (c) => {
  const authUser = getAuthUser(c);
  const input = c.req.valid("json");

  if (input.shelvesToAssign && input.shelvesToAssign.length > 0) {
    await assignBooksToShelves(input.bookIds, input.shelvesToAssign);
  }

  return c.body(null, 200);
});

bookRoutes.post("/progress", zValidator("json", progressSchema, handleValidationError), async (c) => {
  const authUser = getAuthUser(c);
  const input = c.req.valid("json");

  const book = await getBookById(input.bookId);
  if (!book) {
    fail(404, `Book not found: ${input.bookId}`);
  }

  await updateUserBookProgress(authUser.userId, input.bookId, input.progress, book.bookType);

  return c.body(null, 200);
});

bookRoutes.get("/:id/recommendations", async (c) => {
  fail(501, "Book recommendations not yet implemented");
});

bookRoutes.post("/status", zValidator("json", readStatusSchema, handleValidationError), async (c) => {
  const authUser = getAuthUser(c);
  const input = c.req.valid("json");

  await updateUserBookStatus(authUser.userId, input.bookIds, input.status);

  return c.body(null, 200);
});

const resetProgressSchema = z.object({
  bookIds: z.array(z.string()),
});

bookRoutes.post("/reset-progress", zValidator("json", resetProgressSchema, handleValidationError), async (c) => {
  const authUser = getAuthUser(c);
  const input = c.req.valid("json");

  await resetUserBookProgress(authUser.userId, input.bookIds);

  return c.body(null, 200);
});

bookRoutes.put("/personal-rating", zValidator("json", ratingSchema, handleValidationError), async (c) => {
  const authUser = getAuthUser(c);
  const input = c.req.valid("json");

  await updatePersonalRating(authUser.userId, input.ids, input.rating);

  return c.body(null, 200);
});

const resetPersonalRatingSchema = z.object({
  bookIds: z.array(z.string()),
});

bookRoutes.post("/reset-personal-rating", zValidator("json", resetPersonalRatingSchema, handleValidationError), async (c) => {
  const authUser = getAuthUser(c);
  const input = c.req.valid("json");

  await resetPersonalRating(authUser.userId, input.bookIds);

  return c.body(null, 200);
});

bookRoutes.post("/physical", requireAdmin, async (c) => {
  fail(501, "Create physical book not yet implemented");
});

bookRoutes.delete("/", requireAdmin, async (c) => {
  fail(501, "Delete books not yet implemented");
});

bookRoutes.get("/:bookId/cbx/metadata/comicinfo", async (c) => {
  fail(501, "ComicInfo metadata not yet implemented");
});

bookRoutes.get("/:bookId/file-metadata", async (c) => {
  fail(501, "File metadata not yet implemented");
});

bookRoutes.get("/:bookId/content", async (c) => {
  const authUser = getAuthUser(c);
  const bookId = c.req.param("bookId");

  const hasAccess = await checkBookAccess(bookId, authUser.userId, authUser.isAdmin);
  if (!hasAccess) {
    fail(403, "Access denied to this book");
  }

  const fileLocation = await getPrimaryBookFileLocation(bookId);
  const file = Bun.file(fileLocation.filePath);
  const fileExists = await file.exists();
  if (!fileExists) {
    fail(404, `Book file not found for book: ${bookId}`);
  }

  return c.body(file, 200, {
    "content-type": getContentTypeForBookType(fileLocation.bookType),
  });
});

bookRoutes.get("/:bookId/download", async (c) => {
  const authUser = getAuthUser(c);
  const bookId = c.req.param("bookId");

  const hasAccess = await checkBookAccess(bookId, authUser.userId, authUser.isAdmin);
  if (!hasAccess) {
    fail(403, "Access denied to this book");
  }

  const fileLocation = await getPrimaryBookFileLocation(bookId);
  const file = Bun.file(fileLocation.filePath);
  const fileExists = await file.exists();
  if (!fileExists) {
    fail(404, `Book file not found for book: ${bookId}`);
  }

  return c.body(file, 200, {
    "content-type": getContentTypeForBookType(fileLocation.bookType),
    "content-disposition": `attachment; filename="${fileLocation.fileName}"`,
  });
});

bookRoutes.get("/:bookId/download-all", async (c) => {
  const authUser = getAuthUser(c);
  const bookId = c.req.param("bookId");

  const hasAccess = await checkBookAccess(bookId, authUser.userId, authUser.isAdmin);
  if (!hasAccess) {
    fail(403, "Access denied to this book");
  }

  const fileLocation = await getPrimaryBookFileLocation(bookId);
  const file = Bun.file(fileLocation.filePath);
  const fileExists = await file.exists();
  if (!fileExists) {
    fail(404, `Book file not found for book: ${bookId}`);
  }

  return c.body(file, 200, {
    "content-type": getContentTypeForBookType(fileLocation.bookType),
    "content-disposition": `attachment; filename="${fileLocation.fileName}"`,
  });
});

bookRoutes.get("/:bookId/viewer-setting", async (c) => {
  const authUser = getAuthUser(c);
  const bookId = c.req.param("bookId");

  const hasAccess = await checkBookAccess(bookId, authUser.userId, authUser.isAdmin);
  if (!hasAccess) {
    fail(403, "Access denied to this book");
  }

  const book = await getBookById(bookId);
  if (!book) {
    fail(404, `Book not found: ${bookId}`);
  }

  const settings = await getViewerSettingsForUserBook(
    authUser.userId,
    bookId,
    book.bookType,
  );

  return c.json(settings, 200);
});

bookRoutes.put(
  "/:bookId/viewer-setting",
  zValidator("json", updateViewerSettingsSchema, handleValidationError),
  async (c) => {
    const authUser = getAuthUser(c);
    const bookId = c.req.param("bookId");

    const hasAccess = await checkBookAccess(bookId, authUser.userId, authUser.isAdmin);
    if (!hasAccess) {
      fail(403, "Access denied to this book");
    }

    const book = await getBookById(bookId);
    if (!book) {
      fail(404, `Book not found: ${bookId}`);
    }

    const input = c.req.valid("json");
    await updateViewerSettingsForUserBook(
      authUser.userId,
      bookId,
      book.bookType,
      input,
    );

    return c.body(null, 204);
  },
);

bookRoutes.post("/duplicates", requireAdmin, async (c) => {
  fail(501, "Duplicate detection not yet implemented");
});

bookRoutes.patch(
  "/:bookId/physical",
  zValidator("param", bookIdParamSchema, handleValidationError),
  zValidator("query", togglePhysicalQuerySchema, handleValidationError),
  async (c) => {
    const authUser = getAuthUser(c);
    const { bookId } = c.req.valid("param");
    const { physical } = c.req.valid("query");

    if (!authUser.isAdmin && !authUser.canManageLibrary) {
      fail(403, "Forbidden");
    }

    const hasAccess = await checkBookAccess(bookId, authUser.userId, authUser.isAdmin);
    if (!hasAccess) {
      fail(403, "Access denied to this book");
    }

    const updatedBook = await updateBookPhysicalFlag(bookId, physical, authUser.userId);
    return c.json(updatedBook, 200);
  },
);

bookRoutes.post("/:targetBookId/attach-file", requireAdmin, async (c) => {
  fail(501, "Attach book files not yet implemented");
});

bookRoutes.get("/:bookId/metadata", validateBookId, async (c) => {
  const authUser = getAuthUser(c);
  const { bookId } = c.req.valid("param");

  const hasAccess = await checkBookAccess(bookId, authUser.userId, authUser.isAdmin);
  if (!hasAccess) {
    fail(403, "Access denied to this book");
  }

  const metadata = await getBookMetadataWithRelations(bookId);
  if (!metadata) {
    fail(404, `Book metadata not found for book: ${bookId}`);
  }
  assertIsDefined(metadata, "Metadata should be defined");

  return c.json({
    bookId: metadata.metadata.bookId,
    title: metadata.metadata.title,
    subtitle: metadata.metadata.subtitle,
    publisher: metadata.metadata.publisher,
    publishedDate: metadata.metadata.publishedDate,
    description: metadata.metadata.description,
    isbn13: metadata.metadata.isbn13,
    isbn10: metadata.metadata.isbn10,
    pageCount: metadata.metadata.pageCount,
    thumbnail: metadata.metadata.thumbnail,
    language: metadata.metadata.language,
    rating: metadata.metadata.rating,
    cover: metadata.metadata.cover,
    seriesName: metadata.metadata.seriesName,
    seriesNumber: metadata.metadata.seriesNumber,
    seriesTotal: metadata.metadata.seriesTotal,
    authors: metadata.authors,
    categories: metadata.categories,
    locks: {
      allFieldsLocked: metadata.metadata.allFieldsLocked,
      titleLocked: metadata.metadata.titleLocked,
      authorsLocked: metadata.metadata.authorsLocked,
      categoriesLocked: metadata.metadata.categoriesLocked,
      subtitleLocked: metadata.metadata.subtitleLocked,
      publisherLocked: metadata.metadata.publisherLocked,
      publishedDateLocked: metadata.metadata.publishedDateLocked,
      descriptionLocked: metadata.metadata.descriptionLocked,
      isbn13Locked: metadata.metadata.isbn13Locked,
      isbn10Locked: metadata.metadata.isbn10Locked,
      pageCountLocked: metadata.metadata.pageCountLocked,
      thumbnailLocked: metadata.metadata.thumbnailLocked,
      languageLocked: metadata.metadata.languageLocked,
      coverLocked: metadata.metadata.coverLocked,
      ratingLocked: metadata.metadata.ratingLocked,
      reviewCountLocked: metadata.metadata.reviewCountLocked,
      seriesNameLocked: metadata.metadata.seriesNameLocked,
      seriesNumberLocked: metadata.metadata.seriesNumberLocked,
      seriesTotalLocked: metadata.metadata.seriesTotalLocked,
    },
  }, 200);
});

bookRoutes.put("/:bookId/metadata", validateBookId, zValidator("json", metadataUpdateSchema, handleValidationError), async (c) => {
  const authUser = getAuthUser(c);
  const { bookId } = c.req.valid("param");
  const mergeCategories = c.req.query("mergeCategories") === "true";

  const hasAccess = await checkBookAccess(bookId, authUser.userId, authUser.isAdmin);
  if (!hasAccess) {
    fail(403, "Access denied to this book");
  }

  const input = c.req.valid("json");
  const updated = await updateBookMetadata(bookId, input, mergeCategories);

  return c.json(updated, 200);
});
