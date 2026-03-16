import { db, schema } from "../db/client";
import { eq } from "drizzle-orm";
import { fail, assertIsDefined } from "../http/errors";

type UserRow = {
  id: string;
  username: string;
  passwordHash: string;
  isDefaultPassword: boolean;
  name: string;
  email: string | null;
  provisioningMethod: string;
};

type UserPermissionRow = {
  userId: string;
  permissionUpload: boolean;
  permissionDownload: boolean;
  permissionEditMetadata: boolean;
  permissionManipulateLibrary: boolean;
  permissionEmailBook: boolean;
  permissionDeleteBook: boolean;
  permissionAccessOpds: boolean;
  permissionSyncKoreader: boolean;
  permissionSyncKobo: boolean;
  permissionAdmin: boolean;
  permissionManageMetadataConfig: boolean;
  permissionAccessBookdrop: boolean;
  permissionAccessLibraryStats: boolean;
  permissionAccessUserStats: boolean;
  permissionAccessTaskManager: boolean;
  permissionManageGlobalPreferences: boolean;
  permissionManageIcons: boolean;
  permissionManageFonts: boolean;
  permissionBulkAutoFetchMetadata: boolean;
  permissionBulkCustomFetchMetadata: boolean;
  permissionBulkEditMetadata: boolean;
  permissionBulkRegenerateCover: boolean;
  permissionMoveOrganizeFiles: boolean;
  permissionBulkLockUnlockMetadata: boolean;
  permissionBulkResetBookloreReadProgress: boolean;
  permissionBulkResetKoreaderReadProgress: boolean;
  permissionBulkResetBookReadStatus: boolean;
  isDemoUser: boolean;
};

type LibraryRow = {
  id: string;
  name: string;
};

const ensureDb = () => {
  if (!db) {
    fail(503, "Database is not configured. Set DATABASE_URL.");
  }
  return db!;
};

export const getAllUsers = async (): Promise<UserRow[]> => {
  const database = ensureDb();
  
  const rows = await database
    .select({
      id: schema.users.id,
      username: schema.users.username,
      passwordHash: schema.users.passwordHash,
      isDefaultPassword: schema.users.isDefaultPassword,
      name: schema.users.name,
      email: schema.users.email,
      provisioningMethod: schema.users.provisioningMethod,
    })
    .from(schema.users);

  return rows.map(row => ({
    id: row.id,
    username: row.username,
    passwordHash: row.passwordHash,
    isDefaultPassword: row.isDefaultPassword,
    name: row.name,
    email: row.email,
    provisioningMethod: row.provisioningMethod ?? "",
  }));
};

export const getUserById = async (id: string): Promise<UserRow | null> => {
  const database = ensureDb();
  
  const rows = await database
    .select({
      id: schema.users.id,
      username: schema.users.username,
      passwordHash: schema.users.passwordHash,
      isDefaultPassword: schema.users.isDefaultPassword,
      name: schema.users.name,
      email: schema.users.email,
      provisioningMethod: schema.users.provisioningMethod,
    })
    .from(schema.users)
    .where(eq(schema.users.id, id))
    .limit(1);

  if (!rows[0]) return null;
  
  const row = rows[0];
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.passwordHash,
    isDefaultPassword: row.isDefaultPassword,
    name: row.name,
    email: row.email,
    provisioningMethod: row.provisioningMethod ?? "",
  };
};

export const getUserPermissionsByUserId = async (userId: string): Promise<UserPermissionRow | null> => {
  const database = ensureDb();
  
  const rows = await database
    .select()
    .from(schema.userPermissions)
    .where(eq(schema.userPermissions.userId, userId))
    .limit(1);

  if (!rows[0]) return null;
  
  const row = rows[0];
  return {
    userId: row.userId,
    permissionUpload: row.permissionUpload,
    permissionDownload: row.permissionDownload,
    permissionEditMetadata: row.permissionEditMetadata,
    permissionManipulateLibrary: row.permissionManipulateLibrary,
    permissionEmailBook: row.permissionEmailBook,
    permissionDeleteBook: row.permissionDeleteBook,
    permissionAccessOpds: row.permissionAccessOpds,
    permissionSyncKoreader: row.permissionSyncKoreader,
    permissionSyncKobo: row.permissionSyncKobo,
    permissionAdmin: row.permissionAdmin,
    permissionManageMetadataConfig: row.permissionManageMetadataConfig,
    permissionAccessBookdrop: row.permissionAccessBookdrop,
    permissionAccessLibraryStats: row.permissionAccessLibraryStats,
    permissionAccessUserStats: row.permissionAccessUserStats,
    permissionAccessTaskManager: row.permissionAccessTaskManager,
    permissionManageGlobalPreferences: row.permissionManageGlobalPreferences,
    permissionManageIcons: row.permissionManageIcons,
    permissionManageFonts: row.permissionManageFonts,
    permissionBulkAutoFetchMetadata: row.permissionBulkAutoFetchMetadata,
    permissionBulkCustomFetchMetadata: row.permissionBulkCustomFetchMetadata,
    permissionBulkEditMetadata: row.permissionBulkEditMetadata,
    permissionBulkRegenerateCover: row.permissionBulkRegenerateCover,
    permissionMoveOrganizeFiles: row.permissionMoveOrganizeFiles,
    permissionBulkLockUnlockMetadata: row.permissionBulkLockUnlockMetadata,
    permissionBulkResetBookloreReadProgress: row.permissionBulkResetBookloreReadProgress,
    permissionBulkResetKoreaderReadProgress: row.permissionBulkResetKoreaderReadProgress,
    permissionBulkResetBookReadStatus: row.permissionBulkResetBookReadStatus,
    isDemoUser: row.isDemoUser,
  };
};

export const getUserLibrariesByUserId = async (userId: string): Promise<LibraryRow[]> => {
  const database = ensureDb();
  
  const rows = await database
    .select({
      id: schema.libraries.id,
      name: schema.libraries.name,
    })
    .from(schema.libraries)
    .innerJoin(
      schema.userLibraryMapping,
      eq(schema.libraries.id, schema.userLibraryMapping.libraryId)
    )
    .where(eq(schema.userLibraryMapping.userId, userId));

  return rows.map(row => ({
    id: row.id,
    name: row.name,
  }));
};

export const updateUserById = async (
  id: string,
  name: string,
  email: string | null,
  permissions: UserPermissionRow | null,
  assignedLibraries: string[] | null
): Promise<void> => {
  const database = ensureDb();

  await database
    .update(schema.users)
    .set({ name, email })
    .where(eq(schema.users.id, id));

  if (permissions) {
    await database
      .update(schema.userPermissions)
      .set({
        permissionUpload: permissions.permissionUpload,
        permissionDownload: permissions.permissionDownload,
        permissionEditMetadata: permissions.permissionEditMetadata,
        permissionManipulateLibrary: permissions.permissionManipulateLibrary,
        permissionEmailBook: permissions.permissionEmailBook,
        permissionDeleteBook: permissions.permissionDeleteBook,
        permissionAccessOpds: permissions.permissionAccessOpds,
        permissionSyncKoreader: permissions.permissionSyncKoreader,
        permissionSyncKobo: permissions.permissionSyncKobo,
        permissionAdmin: permissions.permissionAdmin,
        permissionManageMetadataConfig: permissions.permissionManageMetadataConfig,
        permissionAccessBookdrop: permissions.permissionAccessBookdrop,
        permissionAccessLibraryStats: permissions.permissionAccessLibraryStats,
        permissionAccessUserStats: permissions.permissionAccessUserStats,
        permissionAccessTaskManager: permissions.permissionAccessTaskManager,
        permissionManageGlobalPreferences: permissions.permissionManageGlobalPreferences,
        permissionManageIcons: permissions.permissionManageIcons,
        permissionManageFonts: permissions.permissionManageFonts,
        permissionBulkAutoFetchMetadata: permissions.permissionBulkAutoFetchMetadata,
        permissionBulkCustomFetchMetadata: permissions.permissionBulkCustomFetchMetadata,
        permissionBulkEditMetadata: permissions.permissionBulkEditMetadata,
        permissionBulkRegenerateCover: permissions.permissionBulkRegenerateCover,
        permissionMoveOrganizeFiles: permissions.permissionMoveOrganizeFiles,
        permissionBulkLockUnlockMetadata: permissions.permissionBulkLockUnlockMetadata,
        permissionBulkResetBookloreReadProgress: permissions.permissionBulkResetBookloreReadProgress,
        permissionBulkResetKoreaderReadProgress: permissions.permissionBulkResetKoreaderReadProgress,
        permissionBulkResetBookReadStatus: permissions.permissionBulkResetBookReadStatus,
      })
      .where(eq(schema.userPermissions.userId, id));
  }

  if (assignedLibraries !== null) {
    await database
      .delete(schema.userLibraryMapping)
      .where(eq(schema.userLibraryMapping.userId, id));

    for (const libraryId of assignedLibraries) {
      await database
        .insert(schema.userLibraryMapping)
        .values({ userId: id, libraryId })
        .onConflictDoNothing();
    }
  }
};

export const deleteUserById = async (id: string): Promise<void> => {
  const database = ensureDb();
  
  await database
    .delete(schema.userLibraryMapping)
    .where(eq(schema.userLibraryMapping.userId, id));
  
  await database
    .delete(schema.userSettings)
    .where(eq(schema.userSettings.userId, id));
  
  await database
    .delete(schema.userPermissions)
    .where(eq(schema.userPermissions.userId, id));
  
  await database
    .delete(schema.refreshToken)
    .where(eq(schema.refreshToken.userId, id));
  
  await database
    .delete(schema.users)
    .where(eq(schema.users.id, id));
};

export const changeUserPassword = async (userId: string, newPassword: string): Promise<void> => {
  const database = ensureDb();
  const passwordHash = await Bun.password.hash(newPassword, { algorithm: "argon2id" });

  await database
    .update(schema.users)
    .set({ passwordHash, isDefaultPassword: false })
    .where(eq(schema.users.id, userId));
};

export const changePassword = async (userId: string, currentPassword: string, newPassword: string): Promise<void> => {
  const database = ensureDb();
  const user = await getUserById(userId);
  assertIsDefined(user, "User not found");

  const permissions = await getUserPermissionsByUserId(userId);
  if (permissions?.isDemoUser) {
    fail(403, "Demo users cannot change their password");
  }

  const valid = await Bun.password.verify(currentPassword, user.passwordHash);
  if (!valid) {
    fail(400, "Current password is incorrect");
  }

  const newHash = await Bun.password.hash(newPassword, { algorithm: "argon2id" });
  const matchesCurrent = await Bun.password.verify(newPassword, user.passwordHash);
  if (matchesCurrent) {
    fail(400, "New password cannot be the same as the current password");
  }

  if (newPassword.length < 8) {
    fail(400, "Password must be at least 8 characters");
  }

  await database
    .update(schema.users)
    .set({ passwordHash: newHash, isDefaultPassword: false })
    .where(eq(schema.users.id, userId));
};

export const getUserSetting = async (userId: string, key: string): Promise<string | null> => {
  const database = ensureDb();
  
  const rows = await database
    .select({ settingValue: schema.userSettings.settingValue })
    .from(schema.userSettings)
    .where(
      eq(schema.userSettings.userId, userId)
    )
    .limit(1);

  const matched = rows.find(r => r.settingValue !== null && typeof r.settingValue === 'object' && 'settingKey' in r.settingValue && r.settingValue.settingKey === key);
  
  if (!matched) return null;
  
  const value = matched.settingValue as Record<string, unknown>;
  return value?.value as string ?? null;
};

export const upsertUserSetting = async (userId: string, key: string, value: string): Promise<void> => {
  const database = ensureDb();
  
  await database
    .insert(schema.userSettings)
    .values({
      userId,
      settingKey: key,
      settingValue: { settingKey: key, value },
    })
    .onConflictDoUpdate({
      target: [schema.userSettings.userId, schema.userSettings.settingKey],
      set: { settingValue: { settingKey: key, value }, updatedAt: new Date() },
    });
};

export type { UserRow, UserPermissionRow, LibraryRow };
