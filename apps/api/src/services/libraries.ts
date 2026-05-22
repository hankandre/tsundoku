import { eq, and, inArray, asc } from "drizzle-orm";
import { schema } from "@tsundoku/db";
import { requireDb } from "../db.ts";

export type LibrarySummary = {
  id: string;
  name: string;
  icon: string | null;
  sortOrder: number;
  organizationMode: schema.OrganizationMode;
  paths: { id: string; path: string }[];
};

async function libraryIdsForUser(userId: string, isAdmin: boolean): Promise<string[] | "all"> {
  if (isAdmin) return "all";
  const db = requireDb();
  const rows = await db
    .select({ libraryId: schema.userLibraryMapping.libraryId })
    .from(schema.userLibraryMapping)
    .where(eq(schema.userLibraryMapping.userId, userId));
  return rows.map((r) => r.libraryId);
}

export async function listLibrariesForUser(
  userId: string,
  isAdmin: boolean,
): Promise<LibrarySummary[]> {
  const db = requireDb();
  const allowed = await libraryIdsForUser(userId, isAdmin);
  if (allowed !== "all" && allowed.length === 0) return [];

  const where = allowed === "all" ? undefined : inArray(schema.libraries.id, allowed);

  const libs = where
    ? await db.select().from(schema.libraries).where(where).orderBy(asc(schema.libraries.sortOrder))
    : await db.select().from(schema.libraries).orderBy(asc(schema.libraries.sortOrder));
  if (libs.length === 0) return [];

  const ids = libs.map((l) => l.id);
  const paths = await db
    .select()
    .from(schema.libraryPaths)
    .where(inArray(schema.libraryPaths.libraryId, ids));
  const pathsByLib = new Map<string, { id: string; path: string }[]>();
  for (const p of paths) {
    const list = pathsByLib.get(p.libraryId) ?? [];
    list.push({ id: p.id, path: p.path });
    pathsByLib.set(p.libraryId, list);
  }
  return libs.map((l) => ({
    id: l.id,
    name: l.name,
    icon: l.icon,
    sortOrder: l.sortOrder,
    organizationMode: l.organizationMode,
    paths: pathsByLib.get(l.id) ?? [],
  }));
}

export async function userCanAccessLibrary(
  userId: string,
  isAdmin: boolean,
  libraryId: string,
): Promise<boolean> {
  if (isAdmin) return true;
  const db = requireDb();
  const rows = await db
    .select()
    .from(schema.userLibraryMapping)
    .where(eq(schema.userLibraryMapping.userId, userId))
    .limit(50);
  return rows.some((r) => r.libraryId === libraryId);
}

export async function createLibrary(input: {
  name: string;
  icon?: string | null;
  organizationMode?: schema.OrganizationMode;
  paths: string[];
}): Promise<LibrarySummary> {
  const db = requireDb();
  const inserted = await db
    .insert(schema.libraries)
    .values({
      name: input.name,
      icon: input.icon ?? null,
      organizationMode: input.organizationMode ?? "BOOK_PER_FILE",
    })
    .returning();
  const lib = inserted[0]!;
  if (input.paths.length) {
    await db
      .insert(schema.libraryPaths)
      .values(input.paths.map((p) => ({ libraryId: lib.id, path: p })));
  }
  return {
    id: lib.id,
    name: lib.name,
    icon: lib.icon,
    sortOrder: lib.sortOrder,
    organizationMode: lib.organizationMode,
    paths: (
      await db
        .select()
        .from(schema.libraryPaths)
        .where(eq(schema.libraryPaths.libraryId, lib.id))
    ).map((p) => ({ id: p.id, path: p.path })),
  };
}

export async function deleteLibrary(libraryId: string) {
  const db = requireDb();
  await db.delete(schema.libraries).where(eq(schema.libraries.id, libraryId));
}

export async function updateLibrary(
  libraryId: string,
  patch: {
    name?: string;
    icon?: string | null;
    organizationMode?: schema.OrganizationMode;
    sortOrder?: number;
  },
): Promise<LibrarySummary | null> {
  const db = requireDb();
  const fields: Record<string, unknown> = {};
  if (patch.name !== undefined) fields["name"] = patch.name;
  if (patch.icon !== undefined) fields["icon"] = patch.icon;
  if (patch.organizationMode !== undefined) fields["organizationMode"] = patch.organizationMode;
  if (patch.sortOrder !== undefined) fields["sortOrder"] = patch.sortOrder;
  if (Object.keys(fields).length === 0) {
    return getLibrary(libraryId);
  }
  await db.update(schema.libraries).set(fields).where(eq(schema.libraries.id, libraryId));
  return getLibrary(libraryId);
}

export async function getLibrary(libraryId: string): Promise<LibrarySummary | null> {
  const db = requireDb();
  const rows = await db
    .select()
    .from(schema.libraries)
    .where(eq(schema.libraries.id, libraryId))
    .limit(1);
  const lib = rows[0];
  if (!lib) return null;
  const paths = await db
    .select()
    .from(schema.libraryPaths)
    .where(eq(schema.libraryPaths.libraryId, libraryId));
  return {
    id: lib.id,
    name: lib.name,
    icon: lib.icon,
    sortOrder: lib.sortOrder,
    organizationMode: lib.organizationMode,
    paths: paths.map((p) => ({ id: p.id, path: p.path })),
  };
}

export async function addLibraryPath(libraryId: string, p: string): Promise<{ id: string; path: string }> {
  const db = requireDb();
  const inserted = await db
    .insert(schema.libraryPaths)
    .values({ libraryId, path: p })
    .returning();
  const row = inserted[0]!;
  return { id: row.id, path: row.path };
}

export async function deleteLibraryPath(libraryId: string, pathId: string): Promise<boolean> {
  const db = requireDb();
  const result = await db
    .delete(schema.libraryPaths)
    .where(
      and(eq(schema.libraryPaths.id, pathId), eq(schema.libraryPaths.libraryId, libraryId)),
    )
    .returning({ id: schema.libraryPaths.id });
  return result.length > 0;
}

/**
 * Library health check — walks the library's paths, verifies they're
 * reachable + readable, and counts orphaned book rows whose files no longer
 * exist. Returns a summary the UI can render as a status badge.
 */
export async function libraryHealth(libraryId: string): Promise<{
  libraryId: string;
  paths: Array<{ id: string; path: string; readable: boolean }>;
  totalBooks: number;
  orphanedBooks: number;
}> {
  const db = requireDb();
  const fs = await import("node:fs/promises");
  const nodePath = await import("node:path");

  const paths = await db
    .select()
    .from(schema.libraryPaths)
    .where(eq(schema.libraryPaths.libraryId, libraryId));

  const pathHealth = await Promise.all(
    paths.map(async (p) => {
      let readable = false;
      try {
        const stat = await fs.stat(p.path);
        readable = stat.isDirectory();
      } catch {
        // path missing / no permission — leaves readable=false
      }
      return { id: p.id, path: p.path, readable };
    }),
  );

  const books = await db
    .select({
      id: schema.books.id,
      libPath: schema.libraryPaths.path,
      fileName: schema.books.fileName,
      fileSubPath: schema.books.fileSubPath,
    })
    .from(schema.books)
    .innerJoin(schema.libraryPaths, eq(schema.libraryPaths.id, schema.books.libraryPathId))
    .where(eq(schema.books.libraryId, libraryId));

  let orphaned = 0;
  await Promise.all(
    books.map(async (b) => {
      const abs = nodePath.join(b.libPath, b.fileSubPath ?? "", b.fileName);
      try {
        await fs.access(abs);
      } catch {
        orphaned += 1;
      }
    }),
  );

  return {
    libraryId,
    paths: pathHealth,
    totalBooks: books.length,
    orphanedBooks: orphaned,
  };
}

/** Returns every book id inside a library. Used for fan-out tasks. */
export async function listBookIdsInLibrary(libraryId: string): Promise<string[]> {
  const db = requireDb();
  const rows = await db
    .select({ id: schema.books.id })
    .from(schema.books)
    .where(eq(schema.books.libraryId, libraryId));
  return rows.map((r) => r.id);
}
