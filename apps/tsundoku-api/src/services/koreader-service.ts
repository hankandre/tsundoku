import { db, schema } from "../db/client";
import { eq } from "drizzle-orm";
import { fail } from "../http/errors";

export interface KoreaderUserRow {
  id: string;
  username: string;
  password: string;
  passwordMd5: string;
  syncEnabled: boolean | null;
  bookloreUserId: string | null;
  createdAt: Date;
  updatedAt: Date | null;
}

const ensureDb = () => {
  if (!db) {
    throw new Error("Database not configured");
  }
  return db;
};

export const getKoreaderUser = async (userId: string): Promise<KoreaderUserRow | null> => {
  const database = ensureDb();
  
  const result = await database
    .select()
    .from(schema.koreaderUser)
    .where(eq(schema.koreaderUser.bookloreUserId, userId));
  
  return result[0] ?? null;
};

export const upsertKoreaderUser = async (
  userId: string,
  username: string,
  password: string,
  passwordMd5: string
): Promise<KoreaderUserRow> => {
  const database = ensureDb();
  
  const existing = await database
    .select()
    .from(schema.koreaderUser)
    .where(eq(schema.koreaderUser.bookloreUserId, userId));
  
  if (existing[0]) {
    await database
      .update(schema.koreaderUser)
      .set({
        username,
        password,
        passwordMd5,
        updatedAt: new Date(),
        updatedBy: userId,
      })
      .where(eq(schema.koreaderUser.bookloreUserId, userId));
  } else {
    const userIdKey = Bun.randomUUIDv7();
    await database.insert(schema.koreaderUser).values({
      id: userIdKey,
      username,
      password,
      passwordMd5,
      syncEnabled: false,
      bookloreUserId: userId,
      createdBy: userId,
    });
  }
  
  const result = await database
    .select()
    .from(schema.koreaderUser)
    .where(eq(schema.koreaderUser.bookloreUserId, userId));
  
  return result[0] as KoreaderUserRow;
};

export const toggleSync = async (userId: string, enabled: boolean): Promise<void> => {
  const database = ensureDb();
  
  await database
    .update(schema.koreaderUser)
    .set({ syncEnabled: enabled, updatedAt: new Date() })
    .where(eq(schema.koreaderUser.bookloreUserId, userId));
};

export const toggleSyncProgressWithBooklore = async (userId: string, enabled: boolean): Promise<void> => {
  fail(501, "KOReader sync progress with Booklore not yet implemented");
};
