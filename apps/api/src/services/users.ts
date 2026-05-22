import { eq, sql } from "drizzle-orm";
import { schema } from "@tsundoku/db";
import { requireDb } from "../db.ts";

type Permissions = {
  upload: boolean;
  download: boolean;
  editMetadata: boolean;
  manipulateLibrary: boolean;
  admin: boolean;
};

const DEFAULT_PERMISSIONS: Permissions = {
  upload: false,
  download: true,
  editMetadata: false,
  manipulateLibrary: false,
  admin: false,
};

export type UserRecord = {
  id: string;
  username: string;
  name: string | null;
  email: string | null;
  passwordHash: string | null;
  permissions: Permissions;
};

function permissionList(p: Permissions): string[] {
  return Object.entries(p)
    .filter(([k, v]) => v && k !== "admin")
    .map(([k]) => k);
}

export async function findByUsername(username: string): Promise<UserRecord | null> {
  const db = requireDb();
  const rows = await db
    .select({
      user: schema.users,
      perms: schema.userPermissions,
    })
    .from(schema.users)
    .leftJoin(schema.userPermissions, eq(schema.userPermissions.userId, schema.users.id))
    .where(eq(schema.users.username, username))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  return {
    id: row.user.id,
    username: row.user.username,
    name: row.user.name,
    email: row.user.email,
    passwordHash: row.user.passwordHash,
    permissions: row.perms
      ? {
          upload: row.perms.upload,
          download: row.perms.download,
          editMetadata: row.perms.editMetadata,
          manipulateLibrary: row.perms.manipulateLibrary,
          admin: row.perms.admin,
        }
      : DEFAULT_PERMISSIONS,
  };
}

export async function findById(id: string): Promise<UserRecord | null> {
  const db = requireDb();
  const rows = await db
    .select({ user: schema.users, perms: schema.userPermissions })
    .from(schema.users)
    .leftJoin(schema.userPermissions, eq(schema.userPermissions.userId, schema.users.id))
    .where(eq(schema.users.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.user.id,
    username: row.user.username,
    name: row.user.name,
    email: row.user.email,
    passwordHash: row.user.passwordHash,
    permissions: row.perms ?? DEFAULT_PERMISSIONS,
  };
}

export async function createLocalUser(input: {
  username: string;
  password: string;
  name?: string;
  email?: string;
  isAdmin?: boolean;
}): Promise<UserRecord> {
  const db = requireDb();
  const passwordHash = await Bun.password.hash(input.password, "bcrypt");
  const inserted = await db
    .insert(schema.users)
    .values({
      username: input.username,
      passwordHash,
      name: input.name ?? null,
      email: input.email ?? null,
    })
    .returning();
  const user = inserted[0];
  if (!user) throw new Error("User insert returned no row");

  const perms: Permissions = {
    ...DEFAULT_PERMISSIONS,
    admin: input.isAdmin ?? false,
  };
  await db.insert(schema.userPermissions).values({ userId: user.id, ...perms });

  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    passwordHash: user.passwordHash,
    permissions: perms,
  };
}

export async function countUsers(): Promise<number> {
  const db = requireDb();
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.users);
  return rows[0]?.n ?? 0;
}

/**
 * Creates the first admin user atomically. Returns null if any user already
 * exists (the bootstrap window has closed). Re-checks inside the transaction
 * so two concurrent setup requests can't both succeed.
 */
export async function createFirstAdminIfEmpty(input: {
  username: string;
  password: string;
  name?: string;
  email?: string;
}): Promise<UserRecord | null> {
  const db = requireDb();
  const passwordHash = await Bun.password.hash(input.password, "bcrypt");
  return db.transaction(async (tx) => {
    const existing = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.users);
    if ((existing[0]?.n ?? 0) > 0) return null;

    const inserted = await tx
      .insert(schema.users)
      .values({
        username: input.username,
        passwordHash,
        name: input.name ?? null,
        email: input.email ?? null,
      })
      .returning();
    const user = inserted[0];
    if (!user) throw new Error("User insert returned no row");

    const perms: Permissions = {
      upload: true,
      download: true,
      editMetadata: true,
      manipulateLibrary: true,
      admin: true,
    };
    await tx.insert(schema.userPermissions).values({ userId: user.id, ...perms });

    return {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      passwordHash: user.passwordHash,
      permissions: perms,
    };
  });
}

export async function verifyPassword(record: UserRecord, plain: string): Promise<boolean> {
  if (!record.passwordHash) return false;
  return Bun.password.verify(plain, record.passwordHash);
}

export function permissionsToList(p: Permissions): string[] {
  return permissionList(p);
}
