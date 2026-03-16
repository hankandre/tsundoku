import { db, schema } from "../db/client";
import { eq } from "drizzle-orm";
import { issueAccessToken, issueRefreshToken, verifyToken } from "./jwt";
import { env } from "../config/env";
import { fail, assertIsDefined } from "../http/errors";

type AuthUser = {
  id: string;
  username: string;
  passwordHash: string;
  isDefaultPassword: boolean;
  name: string;
  email: string | null;
  isAdmin: boolean;
};

export type RegisterUserInput = {
  username: string;
  password: string;
  name: string;
  email: string;
  permissionUpload: boolean;
  permissionDownload: boolean;
  permissionEditMetadata: boolean;
  permissionManageLibrary: boolean;
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
  permissionBulkResetKoReaderReadProgress: boolean;
  permissionBulkResetBookReadStatus: boolean;
  selectedLibraries: string[];
};

const ensureDb = () => {
  if (!db) {
    fail(503, "Database is not configured. Set DATABASE_URL.");
  }
  return db!;
};

const getUserByUsername = async (username: string): Promise<AuthUser | null> => {
  const database = ensureDb();
  
  const rows = await database
    .select({
      id: schema.users.id,
      username: schema.users.username,
      passwordHash: schema.users.passwordHash,
      isDefaultPassword: schema.users.isDefaultPassword,
      name: schema.users.name,
      email: schema.users.email,
      isAdmin: schema.userPermissions.permissionAdmin,
    })
    .from(schema.users)
    .leftJoin(
      schema.userPermissions,
      eq(schema.users.id, schema.userPermissions.userId)
    )
    .where(eq(schema.users.username, username))
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
    isAdmin: row.isAdmin ?? false,
  };
};

const getUserByEmail = async (email: string): Promise<AuthUser | null> => {
  const database = ensureDb();
  
  const rows = await database
    .select({
      id: schema.users.id,
      username: schema.users.username,
      passwordHash: schema.users.passwordHash,
      isDefaultPassword: schema.users.isDefaultPassword,
      name: schema.users.name,
      email: schema.users.email,
      isAdmin: schema.userPermissions.permissionAdmin,
    })
    .from(schema.users)
    .leftJoin(
      schema.userPermissions,
      eq(schema.users.id, schema.userPermissions.userId)
    )
    .where(eq(schema.users.email, email))
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
    isAdmin: row.isAdmin ?? false,
  };
};

const persistRefreshToken = async (userId: string, token: string, expiryAt: Date): Promise<void> => {
  const database = ensureDb();
  await database.insert(schema.refreshToken).values({
    userId,
    token,
    expiryDate: expiryAt,
    revoked: false,
  });
};

const buildLoginResponse = async (user: AuthUser): Promise<Record<string, string>> => {
  const claims = {
    userId: user.id,
    isDefaultPassword: user.isDefaultPassword,
  };

  const accessToken = await issueAccessToken(user.username, claims);
  const refreshToken = await issueRefreshToken(user.username, claims);
  const expiry = new Date(Date.now() + env.refreshTokenTtlMs);
  await persistRefreshToken(user.id, refreshToken, expiry);

  return {
    accessToken,
    refreshToken,
    isDefaultPassword: String(user.isDefaultPassword),
  };
};

export const loginWithPassword = async (username: string, password: string): Promise<Record<string, string>> => {
  const user = await getUserByUsername(username);
  assertIsDefined(user, "Invalid credentials");
  
  const valid = await Bun.password.verify(password, user.passwordHash);
  if (!valid) {
    fail(400, "Invalid credentials");
  }

  return buildLoginResponse(user);
};

export const registerUser = async (input: RegisterUserInput): Promise<void> => {
  const database = ensureDb();

  const existing = await getUserByUsername(input.username);
  if (existing) {
    fail(400, `Username already taken: ${input.username}`);
  }

  const passwordHash = await Bun.password.hash(input.password, {
    algorithm: "argon2id",
  });

  const userId = Bun.randomUUIDv7();

  await database.insert(schema.users).values({
    id: userId,
    username: input.username,
    passwordHash,
    isDefaultPassword: true,
    name: input.name,
    email: input.email,
    provisioningMethod: "LOCAL",
  });

  await database.insert(schema.userPermissions).values({
    userId,
    permissionUpload: input.permissionUpload,
    permissionDownload: input.permissionDownload,
    permissionEditMetadata: input.permissionEditMetadata,
    permissionManipulateLibrary: input.permissionManageLibrary,
    permissionEmailBook: input.permissionEmailBook,
    permissionDeleteBook: input.permissionDeleteBook,
    permissionAccessOpds: input.permissionAccessOpds,
    permissionSyncKoreader: input.permissionSyncKoreader,
    permissionSyncKobo: input.permissionSyncKobo,
    permissionAdmin: input.permissionAdmin,
    permissionManageMetadataConfig: input.permissionManageMetadataConfig,
    permissionAccessBookdrop: input.permissionAccessBookdrop,
    permissionAccessLibraryStats: input.permissionAccessLibraryStats,
    permissionAccessUserStats: input.permissionAccessUserStats,
    permissionAccessTaskManager: input.permissionAccessTaskManager,
    permissionManageGlobalPreferences: input.permissionManageGlobalPreferences,
    permissionManageIcons: input.permissionManageIcons,
    permissionManageFonts: input.permissionManageFonts,
    permissionBulkAutoFetchMetadata: input.permissionBulkAutoFetchMetadata,
    permissionBulkCustomFetchMetadata: input.permissionBulkCustomFetchMetadata,
    permissionBulkEditMetadata: input.permissionBulkEditMetadata,
    permissionBulkRegenerateCover: input.permissionBulkRegenerateCover,
    permissionMoveOrganizeFiles: input.permissionMoveOrganizeFiles,
    permissionBulkLockUnlockMetadata: input.permissionBulkLockUnlockMetadata,
    permissionBulkResetBookloreReadProgress: input.permissionBulkResetBookloreReadProgress,
    permissionBulkResetKoreaderReadProgress: input.permissionBulkResetKoReaderReadProgress,
    permissionBulkResetBookReadStatus: input.permissionBulkResetBookReadStatus,
  });

  for (const libraryId of input.selectedLibraries) {
    await database.insert(schema.userLibraryMapping).values({
      userId,
      libraryId,
    }).onConflictDoNothing();
  }
};

export const loginRemote = async (name: string | undefined, username: string | undefined, email: string | undefined): Promise<Record<string, string>> => {
  let resolvedUser = username ? await getUserByUsername(username) : null;

  if (!resolvedUser && email) {
    resolvedUser = await getUserByEmail(email);
  }

  assertIsDefined(resolvedUser, "User not found and remote user creation is not implemented in Bun migration yet");

  return buildLoginResponse(resolvedUser);
};

export const refreshAccessToken = async (refreshTokenValue: string): Promise<Record<string, string>> => {
  const database = ensureDb();

  const storedTokens = await database
    .select()
    .from(schema.refreshToken)
    .where(eq(schema.refreshToken.token, refreshTokenValue))
    .limit(1);

  const stored = storedTokens[0];
  if (!stored) {
    fail(400, "Refresh token not found");
  }

  if (stored.revoked || stored.expiryDate.getTime() < Date.now()) {
    fail(400, "Invalid or expired refresh token");
  }

  const claims = await verifyToken(refreshTokenValue).catch(() => 
    fail(400, "Invalid or expired refresh token")
  );

  const user = await getUserByUsername(claims.sub);
  assertIsDefined(user, "Invalid or expired refresh token");

  if (user.id !== claims.userId) {
    fail(400, "Invalid or expired refresh token");
  }

  await database
    .update(schema.refreshToken)
    .set({ revoked: true, revocationDate: new Date() })
    .where(eq(schema.refreshToken.id, stored.id));

  const latestRefresh = await issueRefreshToken(user.username, {
    userId: user.id,
    isDefaultPassword: user.isDefaultPassword,
  });

  const expiresAt = new Date(Date.now() + env.refreshTokenTtlMs);
  await database.insert(schema.refreshToken).values({
    userId: user.id,
    token: latestRefresh,
    expiryDate: expiresAt,
    revoked: false,
  });

  const accessToken = await issueAccessToken(user.username, {
    userId: user.id,
    isDefaultPassword: user.isDefaultPassword,
  });

  return {
    accessToken,
    refreshToken: latestRefresh,
  };
};

export const getAuthUserById = async (userId: string): Promise<{ username: string; isDefaultPassword: boolean; isAdmin: boolean; canManageLibrary: boolean; canAccessUserStats: boolean } | null> => {
  const database = ensureDb();

  const rows = await database
    .select({
      username: schema.users.username,
      isDefaultPassword: schema.users.isDefaultPassword,
      isAdmin: schema.userPermissions.permissionAdmin,
      canManageLibrary: schema.userPermissions.permissionManipulateLibrary,
      canAccessUserStats: schema.userPermissions.permissionAccessUserStats,
    })
    .from(schema.users)
    .leftJoin(
      schema.userPermissions,
      eq(schema.users.id, schema.userPermissions.userId)
    )
    .where(eq(schema.users.id, userId))
    .limit(1);

  if (!rows[0]) return null;

  return {
    username: rows[0].username,
    isDefaultPassword: rows[0].isDefaultPassword,
    isAdmin: rows[0].isAdmin ?? false,
    canManageLibrary: rows[0].canManageLibrary ?? false,
    canAccessUserStats: rows[0].canAccessUserStats ?? false,
  };
};

export const logout = async (
  userId: string | null,
  refreshTokenValue: string | null
): Promise<void> => {
  const database = ensureDb();
  
  let resolvedUserId = userId;
  
  if (!resolvedUserId && refreshTokenValue) {
    const tokens = await database
      .select()
      .from(schema.refreshToken)
      .where(eq(schema.refreshToken.token, refreshTokenValue))
      .limit(1);
    
    if (tokens[0]) {
      resolvedUserId = tokens[0].userId;
    }
  }
  
  if (resolvedUserId) {
    await database
      .update(schema.refreshToken)
      .set({ revoked: true, revocationDate: new Date() })
      .where(eq(schema.refreshToken.userId, resolvedUserId));
  }
};
