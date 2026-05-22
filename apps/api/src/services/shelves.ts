import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { schema } from "@tsundoku/db";
import type { MagicShelfRules } from "@tsundoku/db/schema";
import { requireDb } from "../db.ts";
import { compileMagicShelfWhere, type MagicShelfRulesInput } from "./magic-shelf-rules.ts";

export type ShelfRecord = {
  id: string;
  userId: string;
  name: string;
  icon: string | null;
  sortOrder: number;
  bookCount: number;
};

export async function listShelves(userId: string): Promise<ShelfRecord[]> {
  const db = requireDb();
  const rows = await db
    .select()
    .from(schema.shelves)
    .where(eq(schema.shelves.userId, userId))
    .orderBy(asc(schema.shelves.sortOrder), asc(schema.shelves.name));
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const mappings = await db
    .select({
      shelfId: schema.bookShelfMapping.shelfId,
      bookId: schema.bookShelfMapping.bookId,
    })
    .from(schema.bookShelfMapping)
    .where(inArray(schema.bookShelfMapping.shelfId, ids));
  const counts = new Map<string, number>();
  for (const m of mappings) counts.set(m.shelfId, (counts.get(m.shelfId) ?? 0) + 1);
  return rows.map((r) => ({ ...r, bookCount: counts.get(r.id) ?? 0 }));
}

export async function createShelf(input: {
  userId: string;
  name: string;
  icon?: string | null;
}): Promise<ShelfRecord> {
  const db = requireDb();
  const inserted = await db
    .insert(schema.shelves)
    .values({ userId: input.userId, name: input.name, icon: input.icon ?? null })
    .returning();
  const row = inserted[0]!;
  return { ...row, bookCount: 0 };
}

export async function deleteShelf(userId: string, shelfId: string) {
  const db = requireDb();
  await db
    .delete(schema.shelves)
    .where(and(eq(schema.shelves.id, shelfId), eq(schema.shelves.userId, userId)));
}

export async function setShelfBooks(userId: string, shelfId: string, bookIds: string[]) {
  const db = requireDb();
  // Ensure the shelf belongs to the user.
  const owns = await db
    .select({ id: schema.shelves.id })
    .from(schema.shelves)
    .where(and(eq(schema.shelves.id, shelfId), eq(schema.shelves.userId, userId)))
    .limit(1);
  if (!owns[0]) throw new Error("Shelf not found");

  await db.delete(schema.bookShelfMapping).where(eq(schema.bookShelfMapping.shelfId, shelfId));
  if (bookIds.length) {
    await db
      .insert(schema.bookShelfMapping)
      .values(bookIds.map((bookId) => ({ shelfId, bookId })));
  }
}

export async function assignBookToShelves(
  userId: string,
  bookId: string,
  shelfIds: string[],
) {
  const db = requireDb();
  // Validate that all shelfIds belong to the user.
  if (shelfIds.length) {
    const owned = await db
      .select({ id: schema.shelves.id })
      .from(schema.shelves)
      .where(and(eq(schema.shelves.userId, userId), inArray(schema.shelves.id, shelfIds)));
    if (owned.length !== shelfIds.length) throw new Error("Unauthorized shelf reference");
  }

  // Drop existing mappings for this book restricted to user's shelves only.
  const userShelves = await db
    .select({ id: schema.shelves.id })
    .from(schema.shelves)
    .where(eq(schema.shelves.userId, userId));
  const userShelfIds = userShelves.map((s) => s.id);
  if (userShelfIds.length) {
    await db
      .delete(schema.bookShelfMapping)
      .where(
        and(
          eq(schema.bookShelfMapping.bookId, bookId),
          inArray(schema.bookShelfMapping.shelfId, userShelfIds),
        ),
      );
  }
  if (shelfIds.length) {
    await db
      .insert(schema.bookShelfMapping)
      .values(shelfIds.map((shelfId) => ({ bookId, shelfId })));
  }
}

export async function getShelfBookIds(userId: string, shelfId: string): Promise<string[]> {
  const db = requireDb();
  const owns = await db
    .select({ id: schema.shelves.id })
    .from(schema.shelves)
    .where(and(eq(schema.shelves.id, shelfId), eq(schema.shelves.userId, userId)))
    .limit(1);
  if (!owns[0]) return [];
  const rows = await db
    .select({ bookId: schema.bookShelfMapping.bookId })
    .from(schema.bookShelfMapping)
    .where(eq(schema.bookShelfMapping.shelfId, shelfId));
  return rows.map((r) => r.bookId);
}

const EMPTY_RULES: MagicShelfRules = { type: "group", join: "and", rules: [] };

export type MagicShelfRecord = {
  id: string;
  userId: string;
  name: string;
  icon: string | null;
  isPublic: boolean;
  rules: MagicShelfRules;
  bookCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export async function listMagicShelves(userId: string): Promise<MagicShelfRecord[]> {
  const db = requireDb();
  const rows = await db
    .select()
    .from(schema.magicShelves)
    .where(eq(schema.magicShelves.userId, userId))
    .orderBy(asc(schema.magicShelves.name));
  if (!rows.length) return [];
  const ownerScope = await ownerLibraryScope(userId);
  // One COUNT(*) per shelf — fine at the scale magic shelves are used for
  // (typically <50 per user). Batch into a single CTE later if needed.
  const counts = await Promise.all(rows.map((r) => countMagicShelfBooks(r.rules, ownerScope)));
  return rows.map((r, i) => ({ ...r, bookCount: counts[i] ?? 0 }));
}

export async function getMagicShelf(
  userId: string,
  id: string,
): Promise<MagicShelfRecord | null> {
  const db = requireDb();
  const rows = await db
    .select()
    .from(schema.magicShelves)
    .where(and(eq(schema.magicShelves.id, id), eq(schema.magicShelves.userId, userId)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const bookCount = await countMagicShelfBooks(row.rules, await ownerLibraryScope(userId));
  return { ...row, bookCount };
}

export async function createMagicShelf(input: {
  userId: string;
  name: string;
  icon?: string | null;
  isPublic?: boolean;
  rules?: MagicShelfRules;
}): Promise<MagicShelfRecord> {
  const db = requireDb();
  const rules = input.rules ?? EMPTY_RULES;
  const inserted = await db
    .insert(schema.magicShelves)
    .values({
      userId: input.userId,
      name: input.name,
      icon: input.icon ?? null,
      isPublic: input.isPublic ?? false,
      rules,
    })
    .returning();
  const row = inserted[0]!;
  const bookCount = await countMagicShelfBooks(row.rules, await ownerLibraryScope(input.userId));
  return { ...row, bookCount };
}

export async function updateMagicShelf(
  userId: string,
  id: string,
  patch: {
    name?: string;
    icon?: string | null;
    isPublic?: boolean;
    rules?: MagicShelfRules;
  },
): Promise<MagicShelfRecord | null> {
  const db = requireDb();
  // Single statement instead of select-then-update: SET … WHERE id=? AND user_id=?
  // gives us atomic ownership-check + write, and returns zero rows for either
  // missing-id or wrong-owner — both reported as 404 by the caller.
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.name !== undefined) updates.name = patch.name;
  if (patch.icon !== undefined) updates.icon = patch.icon;
  if (patch.isPublic !== undefined) updates.isPublic = patch.isPublic;
  if (patch.rules !== undefined) updates.rules = patch.rules;
  const updated = await db
    .update(schema.magicShelves)
    .set(updates)
    .where(and(eq(schema.magicShelves.id, id), eq(schema.magicShelves.userId, userId)))
    .returning();
  const row = updated[0];
  if (!row) return null;
  const bookCount = await countMagicShelfBooks(row.rules, await ownerLibraryScope(userId));
  return { ...row, bookCount };
}

export async function deleteMagicShelf(userId: string, id: string) {
  const db = requireDb();
  await db
    .delete(schema.magicShelves)
    .where(and(eq(schema.magicShelves.id, id), eq(schema.magicShelves.userId, userId)));
}

// Library scoping for count(): admins see all books; everyone else sees only
// books in libraries they're mapped to. Mirrors books.ts allowedLibraryIds().
type OwnerScope = { libraryIds: string[] } | "all" | "none";

async function ownerLibraryScope(userId: string): Promise<OwnerScope> {
  const db = requireDb();
  const perms = await db
    .select({ admin: schema.userPermissions.admin })
    .from(schema.userPermissions)
    .where(eq(schema.userPermissions.userId, userId))
    .limit(1);
  if (perms[0]?.admin) return "all";
  const rows = await db
    .select({ libraryId: schema.userLibraryMapping.libraryId })
    .from(schema.userLibraryMapping)
    .where(eq(schema.userLibraryMapping.userId, userId));
  if (!rows.length) return "none";
  return { libraryIds: rows.map((r) => r.libraryId) };
}

async function countMagicShelfBooks(rules: MagicShelfRules, scope: OwnerScope): Promise<number> {
  if (scope === "none") return 0;
  const db = requireDb();
  const conds = [compileMagicShelfWhere(rules as MagicShelfRulesInput)];
  if (scope !== "all") conds.push(inArray(schema.books.libraryId, scope.libraryIds));
  const res = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.books)
    .leftJoin(schema.bookMetadata, eq(schema.bookMetadata.bookId, schema.books.id))
    .where(and(...conds));
  return res[0]?.count ?? 0;
}
