import { db, schema } from "../db/client";
import { eq, and, or, asc, inArray } from "drizzle-orm";
import { fail, assertIsDefined } from "../http/errors";

export interface ShelfRow {
  id: string;
  userId: string;
  name: string;
  sort: string | null;
  icon: string;
  iconType: string | null;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date | null;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface CreateShelfRequest {
  name: string;
  icon?: string;
  iconType?: string;
  isPublic?: boolean;
}

export interface UpdateShelfRequest {
  name?: string;
  icon?: string;
  iconType?: string;
  isPublic?: boolean;
}

const ensureDb = () => {
  if (!db) {
    fail(503, "Database is not configured. Set DATABASE_URL.");
  }
  return db!;
};

export const getAllShelvesForUser = async (userId: string): Promise<ShelfRow[]> => {
  const database = ensureDb();

  const rows = await database
    .select({
      id: schema.shelves.id,
      userId: schema.shelves.userId,
      name: schema.shelves.name,
      sort: schema.shelves.sort,
      icon: schema.shelves.icon,
      iconType: schema.shelves.iconType,
      isPublic: schema.shelves.isPublic,
      createdAt: schema.shelves.createdAt,
      updatedAt: schema.shelves.updatedAt,
      createdBy: schema.shelves.createdBy,
      updatedBy: schema.shelves.updatedBy,
    })
    .from(schema.shelves)
    .where(or(eq(schema.shelves.userId, userId), eq(schema.shelves.isPublic, true)))
    .orderBy(asc(schema.shelves.name));

  return rows;
};

export const getShelfById = async (id: string): Promise<ShelfRow | null> => {
  const database = ensureDb();

  const rows = await database
    .select({
      id: schema.shelves.id,
      userId: schema.shelves.userId,
      name: schema.shelves.name,
      sort: schema.shelves.sort,
      icon: schema.shelves.icon,
      iconType: schema.shelves.iconType,
      isPublic: schema.shelves.isPublic,
      createdAt: schema.shelves.createdAt,
      updatedAt: schema.shelves.updatedAt,
      createdBy: schema.shelves.createdBy,
      updatedBy: schema.shelves.updatedBy,
    })
    .from(schema.shelves)
    .where(eq(schema.shelves.id, id))
    .limit(1);

  if (!rows[0]) return null;
  return rows[0];
};

export const createShelf = async (
  request: CreateShelfRequest,
  userId: string,
  isAdmin: boolean
): Promise<ShelfRow> => {
  const database = ensureDb();

  if (request.isPublic && !isAdmin) {
    fail(403, "Only admins can create public shelves");
  }

  const existing = await database
    .select()
    .from(schema.shelves)
    .where(
      and(
        eq(schema.shelves.userId, userId),
        eq(schema.shelves.name, request.name)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    fail(400, `Shelf already exists: ${request.name}`);
  }

  const [shelf] = await database
    .insert(schema.shelves)
    .values({
      userId: userId,
      name: request.name,
      icon: request.icon ?? "bookmark",
      iconType: request.iconType ?? null,
      isPublic: request.isPublic ?? false,
      createdBy: userId,
      updatedBy: userId,
    })
    .returning({
      id: schema.shelves.id,
      userId: schema.shelves.userId,
      name: schema.shelves.name,
      sort: schema.shelves.sort,
      icon: schema.shelves.icon,
      iconType: schema.shelves.iconType,
      isPublic: schema.shelves.isPublic,
      createdAt: schema.shelves.createdAt,
      updatedAt: schema.shelves.updatedAt,
      createdBy: schema.shelves.createdBy,
      updatedBy: schema.shelves.updatedBy,
    });

  return shelf;
};

export const updateShelf = async (
  id: string,
  request: UpdateShelfRequest,
  userId: string,
  isAdmin: boolean
): Promise<ShelfRow> => {
  const database = ensureDb();

  const existing = await getShelfById(id);
  if (!existing) {
    fail(404, `Shelf not found: ${id}`);
  }
  assertIsDefined(existing, `Shelf not found: ${id}`);

  if (request.isPublic && !isAdmin) {
    fail(403, "Only admins can create public shelves");
  }

  const [updated] = await database
    .update(schema.shelves)
    .set({
      name: request.name ?? existing.name,
      icon: request.icon ?? existing.icon,
      iconType: request.iconType ?? existing.iconType,
      isPublic: request.isPublic ?? existing.isPublic,
      updatedAt: new Date(),
    })
    .where(eq(schema.shelves.id, id))
    .returning({
      id: schema.shelves.id,
      userId: schema.shelves.userId,
      name: schema.shelves.name,
      sort: schema.shelves.sort,
      icon: schema.shelves.icon,
      iconType: schema.shelves.iconType,
      isPublic: schema.shelves.isPublic,
      createdAt: schema.shelves.createdAt,
      updatedAt: schema.shelves.updatedAt,
      createdBy: schema.shelves.createdBy,
      updatedBy: schema.shelves.updatedBy,
    });

  return updated;
};

export const deleteShelf = async (id: string): Promise<void> => {
  const database = ensureDb();

  const existing = await getShelfById(id);
  if (!existing) {
    fail(404, `Shelf not found: ${id}`);
  }

  await database.delete(schema.shelves).where(eq(schema.shelves.id, id));
};

export const checkShelfAccess = async (
  shelfId: string,
  userId: string,
  isAdmin: boolean
): Promise<boolean> => {
  if (isAdmin) {
    return true;
  }

  const database = ensureDb();

  const rows = await database
    .select()
    .from(schema.shelves)
    .where(eq(schema.shelves.id, shelfId))
    .limit(1);

  if (!rows[0]) {
    return false;
  }

  const shelf = rows[0];
  return shelf.userId === userId || shelf.isPublic;
};

export const checkShelfOwnership = async (
  shelfId: string,
  userId: string
): Promise<boolean> => {
  const database = ensureDb();

  const rows = await database
    .select()
    .from(schema.shelves)
    .where(eq(schema.shelves.id, shelfId))
    .limit(1);

  if (!rows[0]) {
    return false;
  }

  return rows[0].userId === userId;
};

export const getBooksByShelfId = async (shelfId: string) => {
  const database = ensureDb();

  const rows = await database
    .select({
      id: schema.books.id,
      fileName: schema.books.fileName,
      fileSubPath: schema.books.fileSubPath,
      bookType: schema.books.bookType,
      libraryId: schema.books.libraryId,
      libraryPathId: schema.books.libraryPathId,
      createdAt: schema.books.createdAt,
      updatedAt: schema.books.updatedAt,
      createdBy: schema.books.createdBy,
      updatedBy: schema.books.updatedBy,
    })
    .from(schema.books)
    .innerJoin(
      schema.bookShelfMapping,
      eq(schema.books.id, schema.bookShelfMapping.bookId)
    )
    .where(eq(schema.bookShelfMapping.shelfId, shelfId));

  return rows;
};

export const assignBooksToShelves = async (
  bookIds: string[],
  shelfIds: string[]
): Promise<void> => {
  const database = ensureDb();

  for (const shelfId of shelfIds) {
    for (const bookId of bookIds) {
      const existing = await database
        .select()
        .from(schema.bookShelfMapping)
        .where(
          and(
            eq(schema.bookShelfMapping.bookId, bookId),
            eq(schema.bookShelfMapping.shelfId, shelfId)
          )
        )
        .limit(1);

      if (existing.length === 0) {
        await database.insert(schema.bookShelfMapping).values({
          bookId: bookId,
          shelfId: shelfId,
        });
      }
    }
  }
};

export const unassignBooksFromShelves = async (
  bookIds: string[],
  shelfIds: string[]
): Promise<void> => {
  const database = ensureDb();

  for (const shelfId of shelfIds) {
    await database
      .delete(schema.bookShelfMapping)
      .where(
        and(
          eq(schema.bookShelfMapping.shelfId, shelfId),
          bookIds.length > 0
            ? inArray(schema.bookShelfMapping.bookId, bookIds)
            : undefined
        )
      );
  }
};
