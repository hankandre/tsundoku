import { eq, desc } from "drizzle-orm";
import { schema } from "@tsundoku/db";
import { requireDb } from "../db.ts";
import { createLocalUser } from "./users.ts";

export async function listUsers() {
  const db = requireDb();
  const rows = await db
    .select({
      user: schema.users,
      perms: schema.userPermissions,
    })
    .from(schema.users)
    .leftJoin(schema.userPermissions, eq(schema.userPermissions.userId, schema.users.id))
    .orderBy(desc(schema.users.createdAt));
  return rows.map((r) => ({
    id: r.user.id,
    username: r.user.username,
    name: r.user.name,
    email: r.user.email,
    createdAt: r.user.createdAt,
    permissions: r.perms ?? {
      upload: false,
      download: true,
      editMetadata: false,
      manipulateLibrary: false,
      admin: false,
    },
  }));
}

export async function adminCreateUser(input: {
  username: string;
  password: string;
  name?: string;
  email?: string;
  isAdmin?: boolean;
}) {
  return createLocalUser(input);
}

export async function updateUserPermissions(
  userId: string,
  permissions: {
    upload?: boolean;
    download?: boolean;
    editMetadata?: boolean;
    manipulateLibrary?: boolean;
    admin?: boolean;
  },
) {
  const db = requireDb();
  // Upsert: ensure a row exists.
  const existing = await db
    .select()
    .from(schema.userPermissions)
    .where(eq(schema.userPermissions.userId, userId))
    .limit(1);
  if (existing.length === 0) {
    await db.insert(schema.userPermissions).values({ userId, ...permissions });
  } else {
    await db
      .update(schema.userPermissions)
      .set(permissions)
      .where(eq(schema.userPermissions.userId, userId));
  }
}

export async function deleteUser(userId: string) {
  const db = requireDb();
  await db.delete(schema.users).where(eq(schema.users.id, userId));
}

/**
 * Admin password reset. Replaces the bcrypt hash; doesn't revoke active
 * sessions automatically — caller can chain a revoke-all if needed.
 */
export async function adminSetPassword(userId: string, newPassword: string): Promise<void> {
  const passwordHash = await Bun.password.hash(newPassword, "bcrypt");
  const db = requireDb();
  const result = await db
    .update(schema.users)
    .set({ passwordHash })
    .where(eq(schema.users.id, userId))
    .returning({ id: schema.users.id });
  if (result.length === 0) throw new Error("User not found");
}

export async function getAppSetting(category: string, name: string) {
  const db = requireDb();
  const rows = await db
    .select()
    .from(schema.appSettings)
    .where(eq(schema.appSettings.category, category))
    .limit(50);
  return rows.find((r) => r.name === name) ?? null;
}

export async function setAppSetting(input: { category: string; name: string; val: unknown }) {
  const db = requireDb();
  const existing = await getAppSetting(input.category, input.name);
  if (existing) {
    await db
      .update(schema.appSettings)
      .set({ val: input.val })
      .where(eq(schema.appSettings.id, existing.id));
  } else {
    await db.insert(schema.appSettings).values(input);
  }
}

export async function listAppSettings(category?: string) {
  const db = requireDb();
  if (category) {
    return db.select().from(schema.appSettings).where(eq(schema.appSettings.category, category));
  }
  return db.select().from(schema.appSettings);
}

export async function listUserLibraryAccess(userId: string): Promise<string[]> {
  const db = requireDb();
  const rows = await db
    .select({ libraryId: schema.userLibraryMapping.libraryId })
    .from(schema.userLibraryMapping)
    .where(eq(schema.userLibraryMapping.userId, userId));
  return rows.map((r) => r.libraryId);
}

export async function setUserLibraryAccess(userId: string, libraryIds: string[]): Promise<void> {
  const db = requireDb();
  await db.delete(schema.userLibraryMapping).where(eq(schema.userLibraryMapping.userId, userId));
  if (libraryIds.length) {
    await db
      .insert(schema.userLibraryMapping)
      .values(libraryIds.map((libraryId) => ({ userId, libraryId })));
  }
}

export async function listAuditLog(limit = 100) {
  const db = requireDb();
  return db.select().from(schema.auditLog).orderBy(desc(schema.auditLog.createdAt)).limit(limit);
}

export async function appendAuditLog(input: {
  userId?: string | null;
  username?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  ipAddress?: string;
  detail?: string;
}) {
  const db = requireDb();
  await db.insert(schema.auditLog).values({
    userId: input.userId ?? null,
    username: input.username ?? null,
    action: input.action,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    ipAddress: input.ipAddress ?? null,
    detail: input.detail ?? null,
  });
}
