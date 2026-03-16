import { db, schema } from "../db/client";
import { eq, and } from "drizzle-orm";
import { fail, assertIsDefined } from "../http/errors";

export interface MagicShelfRow {
  id: string;
  userId: string;
  name: string;
  icon: string;
  filterJson: string;
  createdAt: Date;
  updatedAt: Date | null;
}

const ensureDb = () => {
  if (!db) {
    throw new Error("Database not configured");
  }
  return db;
};

export const getMagicShelvesByUser = async (userId: string): Promise<MagicShelfRow[]> => {
  const database = ensureDb();
  
  return await database
    .select()
    .from(schema.magicShelf)
    .where(eq(schema.magicShelf.userId, userId));
};

export const getMagicShelfById = async (id: string, userId: string): Promise<MagicShelfRow | null> => {
  const database = ensureDb();
  
  const result = await database
    .select()
    .from(schema.magicShelf)
    .where(and(
      eq(schema.magicShelf.id, id),
      eq(schema.magicShelf.userId, userId)
    ));
  
  return result[0] ?? null;
};

export interface CreateMagicShelfInput {
  name: string;
  icon: string;
  filterJson: string;
}

export const createMagicShelf = async (userId: string, input: CreateMagicShelfInput): Promise<MagicShelfRow> => {
  const database = ensureDb();
  
  const existing = await database
    .select()
    .from(schema.magicShelf)
    .where(and(
      eq(schema.magicShelf.userId, userId),
      eq(schema.magicShelf.name, input.name)
    ));
  
  if (existing[0]) {
    return updateMagicShelf(existing[0].id, userId, input);
  }
  
  const shelfId = Bun.randomUUIDv7();
  
  await database.insert(schema.magicShelf).values({
    id: shelfId,
    userId,
    name: input.name,
    icon: input.icon,
    filterJson: input.filterJson,
    createdBy: userId,
  });
  
  const result = await database.select().from(schema.magicShelf).where(eq(schema.magicShelf.id, shelfId));
  return result[0] as MagicShelfRow;
};

export const updateMagicShelf = async (id: string, userId: string, input: CreateMagicShelfInput): Promise<MagicShelfRow> => {
  const database = ensureDb();
  
  const existing = await database
    .select()
    .from(schema.magicShelf)
    .where(and(
      eq(schema.magicShelf.id, id),
      eq(schema.magicShelf.userId, userId)
    ));
  
  if (!existing[0]) {
    fail(404, `Magic shelf not found: ${id}`);
  }
  
  await database
    .update(schema.magicShelf)
    .set({
      name: input.name,
      icon: input.icon,
      filterJson: input.filterJson,
      updatedAt: new Date(),
      updatedBy: userId,
    })
    .where(eq(schema.magicShelf.id, id));
  
  const result = await database.select().from(schema.magicShelf).where(eq(schema.magicShelf.id, id));
  return result[0] as MagicShelfRow;
};

export const deleteMagicShelf = async (id: string, userId: string): Promise<void> => {
  const database = ensureDb();
  
  const existing = await database
    .select()
    .from(schema.magicShelf)
    .where(and(
      eq(schema.magicShelf.id, id),
      eq(schema.magicShelf.userId, userId)
    ));
  
  if (!existing[0]) {
    fail(404, `Magic shelf not found: ${id}`);
  }
  
  await database.delete(schema.magicShelf).where(eq(schema.magicShelf.id, id));
};
