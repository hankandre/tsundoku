import { db, schema } from "../db/client";
import { eq, and, inArray, or, asc } from "drizzle-orm";
import { fail } from "../http/errors";

export interface LibraryRow {
  id: string;
  name: string;
  sort: string | null;
  icon: string;
  iconType: string | null;
  fileNamingPattern: string | null;
  watch: boolean;
  formatPriority: string[] | null;
  allowedFormats: string[] | null;
  organizationMode: string | null;
  metadataSource: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface LibraryPathRow {
  id: string;
  path: string | null;
  libraryId: string;
}

export interface CreateLibraryRequest {
  name: string;
  icon?: string;
  iconType?: string;
  watch?: boolean;
  paths: { path: string }[];
  formatPriority?: string[];
  allowedFormats?: string[];
  metadataSource?: string;
  organizationMode?: string;
}

export interface UpdateLibraryRequest {
  name?: string;
  icon?: string;
  iconType?: string;
  watch?: boolean;
  paths?: { path: string }[];
  formatPriority?: string[];
  allowedFormats?: string[];
  metadataSource?: string;
  organizationMode?: string;
  fileNamingPattern?: string;
}

const ensureDb = () => {
  if (!db) {
    fail(503, "Database is not configured. Set DATABASE_URL.");
  }
  return db!;
};

export const getAllLibraries = async (): Promise<LibraryRow[]> => {
  const database = ensureDb();

  const rows = await database
    .select({
      id: schema.libraries.id,
      name: schema.libraries.name,
      sort: schema.libraries.sort,
      icon: schema.libraries.icon,
      iconType: schema.libraries.iconType,
      fileNamingPattern: schema.libraries.fileNamingPattern,
      watch: schema.libraries.watch,
      formatPriority: schema.libraries.formatPriority,
      allowedFormats: schema.libraries.allowedFormats,
      organizationMode: schema.libraries.organizationMode,
      metadataSource: schema.libraries.metadataSource,
      createdAt: schema.libraries.createdAt,
      updatedAt: schema.libraries.updatedAt,
      createdBy: schema.libraries.createdBy,
      updatedBy: schema.libraries.updatedBy,
    })
    .from(schema.libraries)
    .orderBy(asc(schema.libraries.name));

  return rows.map((row) => ({
    ...row,
    formatPriority: row.formatPriority as string[] | null,
    allowedFormats: row.allowedFormats as string[] | null,
  }));
};

export const getLibraryById = async (id: string): Promise<LibraryRow | null> => {
  const database = ensureDb();

  const rows = await database
    .select({
      id: schema.libraries.id,
      name: schema.libraries.name,
      sort: schema.libraries.sort,
      icon: schema.libraries.icon,
      iconType: schema.libraries.iconType,
      fileNamingPattern: schema.libraries.fileNamingPattern,
      watch: schema.libraries.watch,
      formatPriority: schema.libraries.formatPriority,
      allowedFormats: schema.libraries.allowedFormats,
      organizationMode: schema.libraries.organizationMode,
      metadataSource: schema.libraries.metadataSource,
      createdAt: schema.libraries.createdAt,
      updatedAt: schema.libraries.updatedAt,
      createdBy: schema.libraries.createdBy,
      updatedBy: schema.libraries.updatedBy,
    })
    .from(schema.libraries)
    .where(eq(schema.libraries.id, id))
    .limit(1);

  if (!rows[0]) return null;
  const row = rows[0];
  return {
    ...row,
    formatPriority: row.formatPriority as string[] | null,
    allowedFormats: row.allowedFormats as string[] | null,
  };
};

export const getLibraryPathsByLibraryId = async (libraryId: string): Promise<LibraryPathRow[]> => {
  const database = ensureDb();

  const rows = await database
    .select({
      id: schema.libraryPath.id,
      path: schema.libraryPath.path,
      libraryId: schema.libraryPath.libraryId,
    })
    .from(schema.libraryPath)
    .where(eq(schema.libraryPath.libraryId, libraryId));

  return rows;
};

export const createLibrary = async (
  request: CreateLibraryRequest,
  userId: string
): Promise<LibraryRow> => {
  const database = ensureDb();

  const libraryId = Bun.randomUUIDv7();

  const [library] = await database
    .insert(schema.libraries)
    .values({
      id: libraryId,
      name: request.name,
      icon: request.icon ?? "library",
      iconType: request.iconType ?? null,
      watch: request.watch ?? false,
      formatPriority: request.formatPriority ?? null,
      allowedFormats: request.allowedFormats ?? null,
      metadataSource: request.metadataSource ?? null,
      organizationMode: request.organizationMode ?? null,
      createdBy: userId,
      updatedBy: userId,
    })
    .returning({
      id: schema.libraries.id,
      name: schema.libraries.name,
      sort: schema.libraries.sort,
      icon: schema.libraries.icon,
      iconType: schema.libraries.iconType,
      fileNamingPattern: schema.libraries.fileNamingPattern,
      watch: schema.libraries.watch,
      formatPriority: schema.libraries.formatPriority,
      allowedFormats: schema.libraries.allowedFormats,
      organizationMode: schema.libraries.organizationMode,
      metadataSource: schema.libraries.metadataSource,
      createdAt: schema.libraries.createdAt,
      updatedAt: schema.libraries.updatedAt,
      createdBy: schema.libraries.createdBy,
      updatedBy: schema.libraries.updatedBy,
    });

  if (request.paths && request.paths.length > 0) {
    const pathValues = request.paths.map((p) => ({
      id: Bun.randomUUIDv7(),
      path: p.path,
      libraryId: libraryId,
    }));

    await database.insert(schema.libraryPath).values(pathValues);
  }

  await database.insert(schema.userLibraryMapping).values({
    userId: userId,
    libraryId: libraryId,
  });

  return {
    ...library,
    formatPriority: library.formatPriority as string[] | null,
    allowedFormats: library.allowedFormats as string[] | null,
  };
};

export const updateLibrary = async (
  id: string,
  request: UpdateLibraryRequest
): Promise<LibraryRow> => {
  const database = ensureDb();

  const existing = await getLibraryById(id);
  if (!existing) {
    fail(404, `Library not found: ${id}`);
  }

  const updateData: Partial<typeof schema.libraries.$inferInsert> = {};

  if (request.name !== undefined) {
    updateData.name = request.name;
  }
  if (request.icon !== undefined) {
    updateData.icon = request.icon;
  }
  if (request.iconType !== undefined) {
    updateData.iconType = request.iconType;
  }
  if (request.watch !== undefined) {
    updateData.watch = request.watch;
  }
  if (request.formatPriority !== undefined) {
    updateData.formatPriority = request.formatPriority;
  }
  if (request.allowedFormats !== undefined) {
    updateData.allowedFormats = request.allowedFormats;
  }
  if (request.metadataSource !== undefined) {
    updateData.metadataSource = request.metadataSource;
  }
  if (request.organizationMode !== undefined) {
    updateData.organizationMode = request.organizationMode;
  }
  if (request.fileNamingPattern !== undefined) {
    updateData.fileNamingPattern = request.fileNamingPattern;
  }

  const [updated] = await database
    .update(schema.libraries)
    .set({
      ...updateData,
      updatedAt: new Date(),
    })
    .where(eq(schema.libraries.id, id))
    .returning({
      id: schema.libraries.id,
      name: schema.libraries.name,
      sort: schema.libraries.sort,
      icon: schema.libraries.icon,
      iconType: schema.libraries.iconType,
      fileNamingPattern: schema.libraries.fileNamingPattern,
      watch: schema.libraries.watch,
      formatPriority: schema.libraries.formatPriority,
      allowedFormats: schema.libraries.allowedFormats,
      organizationMode: schema.libraries.organizationMode,
      metadataSource: schema.libraries.metadataSource,
      createdAt: schema.libraries.createdAt,
      updatedAt: schema.libraries.updatedAt,
      createdBy: schema.libraries.createdBy,
      updatedBy: schema.libraries.updatedBy,
    });

  if (request.paths !== undefined) {
    const existingPaths = await getLibraryPathsByLibraryId(id);
    const existingPathSet = new Set(existingPaths.map((p) => p.path));
    const newPathSet = new Set(request.paths.map((p) => p.path));

    const pathsToDelete = existingPaths.filter((p) => !newPathSet.has(p.path ?? ""));
    const pathsToAdd = request.paths.filter((p) => !existingPathSet.has(p.path));

    if (pathsToDelete.length > 0) {
      const idsToDelete = pathsToDelete.map((p) => p.id);
      await database
        .delete(schema.libraryPath)
        .where(inArray(schema.libraryPath.id, idsToDelete));
    }

    if (pathsToAdd.length > 0) {
      const pathValues = pathsToAdd.map((p) => ({
        id: Bun.randomUUIDv7(),
        path: p.path,
        libraryId: id,
      }));
      await database.insert(schema.libraryPath).values(pathValues);
    }
  }

  return {
    ...updated,
    formatPriority: updated.formatPriority as string[] | null,
    allowedFormats: updated.allowedFormats as string[] | null,
  };
};

export const deleteLibrary = async (id: string): Promise<void> => {
  const database = ensureDb();

  const existing = await getLibraryById(id);
  if (!existing) {
    fail(404, `Library not found: ${id}`);
  }

  await database.delete(schema.libraries).where(eq(schema.libraries.id, id));
};

export const setFileNamingPattern = async (
  id: string,
  pattern: string
): Promise<LibraryRow> => {
  const database = ensureDb();

  const existing = await getLibraryById(id);
  if (!existing) {
    fail(404, `Library not found: ${id}`);
  }

  const [updated] = await database
    .update(schema.libraries)
    .set({
      fileNamingPattern: pattern,
      updatedAt: new Date(),
    })
    .where(eq(schema.libraries.id, id))
    .returning({
      id: schema.libraries.id,
      name: schema.libraries.name,
      sort: schema.libraries.sort,
      icon: schema.libraries.icon,
      iconType: schema.libraries.iconType,
      fileNamingPattern: schema.libraries.fileNamingPattern,
      watch: schema.libraries.watch,
      formatPriority: schema.libraries.formatPriority,
      allowedFormats: schema.libraries.allowedFormats,
      organizationMode: schema.libraries.organizationMode,
      metadataSource: schema.libraries.metadataSource,
      createdAt: schema.libraries.createdAt,
      updatedAt: schema.libraries.updatedAt,
      createdBy: schema.libraries.createdBy,
      updatedBy: schema.libraries.updatedBy,
    });

  return {
    ...updated,
    formatPriority: updated.formatPriority as string[] | null,
    allowedFormats: updated.allowedFormats as string[] | null,
  };
};

export const getLibrariesByUserId = async (userId: string): Promise<LibraryRow[]> => {
  const database = ensureDb();

  const rows = await database
    .select({
      id: schema.libraries.id,
      name: schema.libraries.name,
      sort: schema.libraries.sort,
      icon: schema.libraries.icon,
      iconType: schema.libraries.iconType,
      fileNamingPattern: schema.libraries.fileNamingPattern,
      watch: schema.libraries.watch,
      formatPriority: schema.libraries.formatPriority,
      allowedFormats: schema.libraries.allowedFormats,
      organizationMode: schema.libraries.organizationMode,
      metadataSource: schema.libraries.metadataSource,
      createdAt: schema.libraries.createdAt,
      updatedAt: schema.libraries.updatedAt,
      createdBy: schema.libraries.createdBy,
      updatedBy: schema.libraries.updatedBy,
    })
    .from(schema.libraries)
    .innerJoin(schema.userLibraryMapping, eq(schema.libraries.id, schema.userLibraryMapping.libraryId))
    .where(eq(schema.userLibraryMapping.userId, userId))
    .orderBy(asc(schema.libraries.name));

  return rows.map((row) => ({
    ...row,
    formatPriority: row.formatPriority as string[] | null,
    allowedFormats: row.allowedFormats as string[] | null,
  }));
};

export const checkLibraryAccess = async (
  libraryId: string,
  userId: string,
  isAdmin: boolean
): Promise<boolean> => {
  if (isAdmin) {
    return true;
  }

  const database = ensureDb();

  const rows = await database
    .select()
    .from(schema.userLibraryMapping)
    .where(
      and(
        eq(schema.userLibraryMapping.libraryId, libraryId),
        eq(schema.userLibraryMapping.userId, userId)
      )
    )
    .limit(1);

  return rows.length > 0;
};
