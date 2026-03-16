import { Hono, Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppVariables, AuthUser } from "../types/app-variables";
import { fail, handleValidationError } from "../http/errors";
import { requireAdmin } from "../middleware/auth-middleware";
import {
  getAllUsers,
  getUserById,
  getUserPermissionsByUserId,
  getUserLibrariesByUserId,
  updateUserById,
  deleteUserById,
  changeUserPassword as changeUserPasswordService,
  changePassword,
  upsertUserSetting,
  type UserRow,
  type UserPermissionRow,
  type LibraryRow,
} from "../services/user-service";

const mustGetUserById = (user: UserRow | null, id: string): UserRow => {
  if (user === null) {
    fail(404, `User not found: ${id}`);
  }
  return user as UserRow;
};

const mustGetUser = (user: UserRow | null): UserRow => {
  if (user === null) {
    fail(404, "User not found");
  }
  return user as UserRow;
};

const mustGetAuthUser = (authUser: AuthUser | undefined): AuthUser => {
  if (authUser === undefined) {
    fail(401, "Unauthorized");
  }
  return authUser as AuthUser;
};

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(1),
});

const changeUserPasswordSchema = z.object({
  userId: z.uuidv7(),
  newPassword: z.string().min(1),
});

const userUpdatePermissionsSchema = z.object({
  isAdmin: z.boolean().default(false),
  canUpload: z.boolean().default(false),
  canDownload: z.boolean().default(false),
  canEditMetadata: z.boolean().default(false),
  canManageLibrary: z.boolean().default(false),
  canEmailBook: z.boolean().default(false),
  canDeleteBook: z.boolean().default(false),
  canAccessOpds: z.boolean().default(false),
  canSyncKoReader: z.boolean().default(false),
  canSyncKobo: z.boolean().default(false),
  canManageMetadataConfig: z.boolean().default(false),
  canAccessBookdrop: z.boolean().default(false),
  canAccessLibraryStats: z.boolean().default(false),
  canAccessUserStats: z.boolean().default(false),
  canAccessTaskManager: z.boolean().default(false),
  canManageGlobalPreferences: z.boolean().default(false),
  canManageIcons: z.boolean().default(false),
  canManageFonts: z.boolean().default(false),
  canBulkAutoFetchMetadata: z.boolean().default(false),
  canBulkCustomFetchMetadata: z.boolean().default(false),
  canBulkEditMetadata: z.boolean().default(false),
  canBulkRegenerateCover: z.boolean().default(false),
  canMoveOrganizeFiles: z.boolean().default(false),
  canBulkLockUnlockMetadata: z.boolean().default(false),
  canBulkResetBookloreReadProgress: z.boolean().default(false),
  canBulkResetKoReaderReadProgress: z.boolean().default(false),
  canBulkResetBookReadStatus: z.boolean().default(false),
});

const userUpdateRequestSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().nullable().optional(),
  permissions: userUpdatePermissionsSchema.optional(),
  assignedLibraries: z.array(z.uuidv7()).optional(),
});

const updateUserSettingSchema = z.object({
  key: z.string().min(1),
  value: z.any(),
});

interface BookLoreUser {
  id: string;
  username: string;
  isDefaultPassword: boolean;
  name: string;
  email: string | null;
  provisioningMethod: string;
  assignedLibraries: LibraryRow[];
  permissions: {
    isAdmin: boolean;
    canUpload: boolean;
    canDownload: boolean;
    canEditMetadata: boolean;
    canManageLibrary: boolean;
    canSyncKoReader: boolean;
    canSyncKobo: boolean;
    canEmailBook: boolean;
    canDeleteBook: boolean;
    canAccessOpds: boolean;
    canManageMetadataConfig: boolean;
    canAccessBookdrop: boolean;
    canAccessLibraryStats: boolean;
    canAccessUserStats: boolean;
    canAccessTaskManager: boolean;
    canManageGlobalPreferences: boolean;
    canManageIcons: boolean;
    canManageFonts: boolean;
    isDemoUser: boolean;
    canBulkAutoFetchMetadata: boolean;
    canBulkCustomFetchMetadata: boolean;
    canBulkEditMetadata: boolean;
    canBulkRegenerateCover: boolean;
    canMoveOrganizeFiles: boolean;
    canBulkLockUnlockMetadata: boolean;
    canBulkResetBookloreReadProgress: boolean;
    canBulkResetKoReaderReadProgress: boolean;
    canBulkResetBookReadStatus: boolean;
  };
  userSettings: Record<string, unknown>;
}

const mapRowToUser = (
  user: UserRow,
  permissions: UserPermissionRow | null,
  libraries: LibraryRow[],
): BookLoreUser => ({
  id: user.id,
  username: user.username,
  isDefaultPassword: user.isDefaultPassword,
  name: user.name,
  email: user.email,
  provisioningMethod: user.provisioningMethod,
  assignedLibraries: libraries,
  permissions: {
    isAdmin: permissions?.permissionAdmin ?? false,
    canUpload: permissions?.permissionUpload ?? false,
    canDownload: permissions?.permissionDownload ?? false,
    canEditMetadata: permissions?.permissionEditMetadata ?? false,
    canManageLibrary: permissions?.permissionManipulateLibrary ?? false,
    canSyncKoReader: permissions?.permissionSyncKoreader ?? false,
    canSyncKobo: permissions?.permissionSyncKobo ?? false,
    canEmailBook: permissions?.permissionEmailBook ?? false,
    canDeleteBook: permissions?.permissionDeleteBook ?? false,
    canAccessOpds: permissions?.permissionAccessOpds ?? false,
    canManageMetadataConfig:
      permissions?.permissionManageMetadataConfig ?? false,
    canAccessBookdrop: permissions?.permissionAccessBookdrop ?? false,
    canAccessLibraryStats: permissions?.permissionAccessLibraryStats ?? false,
    canAccessUserStats: permissions?.permissionAccessUserStats ?? false,
    canAccessTaskManager: permissions?.permissionAccessTaskManager ?? false,
    canManageGlobalPreferences:
      permissions?.permissionManageGlobalPreferences ?? false,
    canManageIcons: permissions?.permissionManageIcons ?? false,
    canManageFonts: permissions?.permissionManageFonts ?? false,
    isDemoUser: permissions?.isDemoUser ?? false,
    canBulkAutoFetchMetadata:
      permissions?.permissionBulkAutoFetchMetadata ?? false,
    canBulkCustomFetchMetadata:
      permissions?.permissionBulkCustomFetchMetadata ?? false,
    canBulkEditMetadata: permissions?.permissionBulkEditMetadata ?? false,
    canBulkRegenerateCover: permissions?.permissionBulkRegenerateCover ?? false,
    canMoveOrganizeFiles: permissions?.permissionMoveOrganizeFiles ?? false,
    canBulkLockUnlockMetadata:
      permissions?.permissionBulkLockUnlockMetadata ?? false,
    canBulkResetBookloreReadProgress:
      permissions?.permissionBulkResetBookloreReadProgress ?? false,
    canBulkResetKoReaderReadProgress:
      permissions?.permissionBulkResetKoreaderReadProgress ?? false,
    canBulkResetBookReadStatus:
      permissions?.permissionBulkResetBookReadStatus ?? false,
  },
  userSettings: {},
});

const requireCanViewUserProfile = async (
  c: Context,
  next: () => Promise<void>,
) => {
  const user = c.get("authUser");
  if (!user) {
    fail(401, "Unauthorized");
  }

  const targetUserId = c.req.param("id");
  const isAdmin = user.isAdmin;
  const isSelf = user.userId === targetUserId;

  if (!isAdmin && !isSelf) {
    fail(403, "Forbidden");
  }

  await next();
};

const requireIsSelf = async (c: Context, next: () => Promise<void>) => {
  const user = c.get("authUser");
  if (!user) {
    fail(401, "Unauthorized");
  }

  const targetUserId = c.req.param("id");
  if (user.userId !== targetUserId) {
    fail(403, "Forbidden");
  }

  await next();
};

const requireAuthUser = async (c: Context, next: () => Promise<void>) => {
  const user = c.get("authUser");
  if (!user) {
    fail(401, "Unauthorized");
  }
  await next();
};

export const userRoutes = new Hono<{ Variables: AppVariables }>();

userRoutes.get("/me", requireAuthUser, async (c) => {
  const authUser = mustGetAuthUser(c.get("authUser"));
  const userId = authUser.userId;
  const user = mustGetUser(await getUserById(userId));

  const permissions = await getUserPermissionsByUserId(userId);
  const libraries = await getUserLibrariesByUserId(userId);

  return c.json(mapRowToUser(user, permissions, libraries), 200);
});

userRoutes.get("/:id", requireCanViewUserProfile, async (c) => {
  const idRaw = c.req.param("id");
  const parsed = z.uuidv7().safeParse(idRaw);
  if (!parsed.success) {
    fail(400, "Invalid ID parameter");
  }
  const id = idRaw as string;

  const user = mustGetUserById(await getUserById(id), id);
  const permissions = await getUserPermissionsByUserId(id);
  const libraries = await getUserLibrariesByUserId(id);

  return c.json(mapRowToUser(user, permissions, libraries), 200);
});

userRoutes.get("/:id", requireCanViewUserProfile, async (c) => {
  const idRaw = c.req.param("id");
  const parsed = z.uuidv7().safeParse(idRaw);
  if (!parsed.success) {
    fail(400, "Invalid ID parameter");
  }
  const id = idRaw as string;

  const user = mustGetUserById(await getUserById(id), id);
  const permissions = await getUserPermissionsByUserId(id);
  const libraries = await getUserLibrariesByUserId(id);

  return c.json(mapRowToUser(user, permissions, libraries), 200);
});

userRoutes.get("/", requireAdmin, async (c) => {
  const users = await getAllUsers();

  const results: BookLoreUser[] = [];
  for (const user of users) {
    const permissions = await getUserPermissionsByUserId(user.id);
    const libraries = await getUserLibrariesByUserId(user.id);
    results.push(mapRowToUser(user, permissions, libraries));
  }

  return c.json(results, 200);
});

userRoutes.put(
  "/:id",
  requireAdmin,
  zValidator("json", userUpdateRequestSchema, handleValidationError),
  async (c) => {
    const idRaw = c.req.param("id");
    const parsed = z.uuidv7().safeParse(idRaw);
    if (!parsed.success) {
      fail(400, "Invalid ID parameter");
    }
    const id = idRaw as string;
    const payload = c.req.valid("json");

    const existing = mustGetUserById(await getUserById(id), id);
    const authUser = mustGetAuthUser(c.get("authUser"));
    const authUserId = authUser.userId;

    const authUserPermissions = await getUserPermissionsByUserId(authUserId);
    const isAdmin = authUserPermissions?.permissionAdmin ?? false;

    const permissions: UserPermissionRow | null =
      payload.permissions && isAdmin
        ? {
            userId: id,
            permissionUpload: payload.permissions.canUpload,
            permissionDownload: payload.permissions.canDownload,
            permissionEditMetadata: payload.permissions.canEditMetadata,
            permissionManipulateLibrary: payload.permissions.canManageLibrary,
            permissionEmailBook: payload.permissions.canEmailBook,
            permissionDeleteBook: payload.permissions.canDeleteBook,
            permissionAccessOpds: payload.permissions.canAccessOpds,
            permissionSyncKoreader: payload.permissions.canSyncKoReader,
            permissionSyncKobo: payload.permissions.canSyncKobo,
            permissionAdmin: payload.permissions.isAdmin,
            permissionManageMetadataConfig:
              payload.permissions.canManageMetadataConfig,
            permissionAccessBookdrop: payload.permissions.canAccessBookdrop,
            permissionAccessLibraryStats:
              payload.permissions.canAccessLibraryStats,
            permissionAccessUserStats: payload.permissions.canAccessUserStats,
            permissionAccessTaskManager:
              payload.permissions.canAccessTaskManager,
            permissionManageGlobalPreferences:
              payload.permissions.canManageGlobalPreferences,
            permissionManageIcons: payload.permissions.canManageIcons,
            permissionManageFonts: payload.permissions.canManageFonts,
            permissionBulkAutoFetchMetadata:
              payload.permissions.canBulkAutoFetchMetadata,
            permissionBulkCustomFetchMetadata:
              payload.permissions.canBulkCustomFetchMetadata,
            permissionBulkEditMetadata: payload.permissions.canBulkEditMetadata,
            permissionBulkRegenerateCover:
              payload.permissions.canBulkRegenerateCover,
            permissionMoveOrganizeFiles:
              payload.permissions.canMoveOrganizeFiles,
            permissionBulkLockUnlockMetadata:
              payload.permissions.canBulkLockUnlockMetadata,
            permissionBulkResetBookloreReadProgress:
              payload.permissions.canBulkResetBookloreReadProgress,
            permissionBulkResetKoreaderReadProgress:
              payload.permissions.canBulkResetKoReaderReadProgress,
            permissionBulkResetBookReadStatus:
              payload.permissions.canBulkResetBookReadStatus,
            isDemoUser: false,
          }
        : null;

    await updateUserById(
      id,
      payload.name ?? existing.name,
      payload.email !== undefined ? payload.email : existing.email,
      permissions,
      payload.assignedLibraries ?? null,
    );

    const updated = mustGetUserById(await getUserById(id), id);
    const updatedPermissions = await getUserPermissionsByUserId(id);
    const updatedLibraries = await getUserLibrariesByUserId(id);

    return c.json(
      mapRowToUser(updated, updatedPermissions, updatedLibraries),
      200,
    );
  },
);

userRoutes.delete("/:id", requireAdmin, async (c) => {
  const idRaw = c.req.param("id");
  const parsed = z.uuidv7().safeParse(idRaw);
  if (!parsed.success) {
    fail(400, "Invalid ID parameter");
  }

  const authUser = mustGetAuthUser(c.get("authUser"));

  if (authUser.userId === idRaw) {
    fail(400, "You cannot delete your own account");
  }

  mustGetUserById(await getUserById(idRaw), idRaw);

  await deleteUserById(idRaw);

  return c.body(null, 204);
});

userRoutes.put(
  "/change-password",
  requireAuthUser,
  zValidator("json", changePasswordSchema, handleValidationError),
  async (c) => {
    const authUser = mustGetAuthUser(c.get("authUser"));
    const payload = c.req.valid("json");
    await changePassword(
      authUser.userId,
      payload.currentPassword,
      payload.newPassword,
    );

    return c.body(null, 200);
  },
);

userRoutes.put(
  "/change-user-password",
  requireAdmin,
  zValidator("json", changeUserPasswordSchema, handleValidationError),
  async (c) => {
    const payload = c.req.valid("json");

    mustGetUserById(await getUserById(payload.userId), payload.userId);

    if (payload.newPassword.length < 8) {
      fail(400, "Password must be at least 8 characters");
    }

    await changeUserPasswordService(payload.userId, payload.newPassword);

    return c.body(null, 200);
  },
);

userRoutes.put(
  "/:id/settings",
  requireIsSelf,
  zValidator("json", updateUserSettingSchema, handleValidationError),
  async (c) => {
    const idRaw = c.req.param("id");
    const parsed = z.uuidv7().safeParse(idRaw);
    if (!parsed.success) {
      fail(400, "Invalid ID parameter");
    }
    const id = idRaw as string;
    const payload = c.req.valid("json");

    const existing = await getUserById(id);
    if (!existing) {
      fail(404, `User not found: ${id}`);
    }

    const validKeys = [
      "perBookSetting",
      "pdfReaderSetting",
      "newPdfReaderSetting",
      "epubReaderSetting",
      "ebookReaderSetting",
      "cbxReaderSetting",
      "sidebarLibrarySorting",
      "sidebarShelfSorting",
      "sidebarMagicShelfSorting",
      "entityViewPreferences",
      "tableColumnPreference",
      "filterMode",
      "filterSortingMode",
      "metadataCenterViewMode",
      "koReaderEnabled",
      "enableSeriesView",
      "autoSaveMetadata",
      "visibleFilters",
      "visibleSortFields",
      "dashboardConfig",
    ];

    if (!validKeys.includes(payload.key)) {
      fail(400, `Unknown setting key: ${payload.key}`);
    }

    let serializedValue: string;
    if (typeof payload.value === "object") {
      serializedValue = JSON.stringify(payload.value);
    } else {
      serializedValue = String(payload.value);
    }

    await upsertUserSetting(id, payload.key, serializedValue);

    return c.body(null, 204);
  },
);
