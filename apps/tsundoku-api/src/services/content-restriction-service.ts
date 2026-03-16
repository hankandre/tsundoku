import { db, schema } from "../db/client";
import { eq, and } from "drizzle-orm";
import { fail, assertIsDefined } from "../http/errors";

const ensureDb = () => {
  if (!db) {
    throw new Error("Database not configured");
  }
  return db;
};

export interface ContentRestriction {
  id: string;
  userId: string;
  restrictionType: string;
  mode: string;
  value: string;
  createdAt: Date;
  createdBy: string | null;
}

export const getUserRestrictions = async (userId: string): Promise<ContentRestriction[]> => {
  const database = ensureDb();

  const result = await database
    .select()
    .from(schema.userContentRestriction)
    .where(eq(schema.userContentRestriction.userId, userId));

  return result;
};

export const addRestriction = async (
  userId: string,
  restriction: { restrictionType: string; mode: string; value: string },
  createdBy: string
): Promise<ContentRestriction> => {
  const database = ensureDb();

  const existing = await database
    .select()
    .from(schema.userContentRestriction)
    .where(
      and(
        eq(schema.userContentRestriction.userId, userId),
        eq(schema.userContentRestriction.restrictionType, restriction.restrictionType),
        eq(schema.userContentRestriction.value, restriction.value)
      )
    )
    .limit(1);

  if (existing[0]) {
    fail(400, "Restriction already exists");
  }

  const id = Bun.randomUUIDv7();

  const result = await database
    .insert(schema.userContentRestriction)
    .values({
      id,
      userId,
      restrictionType: restriction.restrictionType,
      mode: restriction.mode,
      value: restriction.value,
      createdBy,
    })
    .returning();

  return result[0];
};

export const updateRestrictions = async (
  userId: string,
  restrictions: Array<{ restrictionType: string; mode: string; value: string }>,
  createdBy: string
): Promise<ContentRestriction[]> => {
  const database = ensureDb();

  await database
    .delete(schema.userContentRestriction)
    .where(eq(schema.userContentRestriction.userId, userId));

  const inserted = await database
    .insert(schema.userContentRestriction)
    .values(
      restrictions.map((r) => ({
        userId,
        restrictionType: r.restrictionType,
        mode: r.mode,
        value: r.value,
        createdBy,
      }))
    )
    .returning();

  return inserted;
};

export const deleteRestriction = async (restrictionId: string): Promise<void> => {
  const database = ensureDb();

  await database
    .delete(schema.userContentRestriction)
    .where(eq(schema.userContentRestriction.id, restrictionId));
};

export const deleteAllUserRestrictions = async (userId: string): Promise<void> => {
  const database = ensureDb();

  await database
    .delete(schema.userContentRestriction)
    .where(eq(schema.userContentRestriction.userId, userId));
};
