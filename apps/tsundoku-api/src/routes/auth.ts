import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { env } from "../config/env";
import { requireAdmin } from "../middleware/auth-middleware";
import {
  loginRemote,
  loginWithPassword,
  refreshAccessToken,
  registerUser,
  logout,
} from "../auth/user-auth-service";
import type { AppVariables } from "../types/app-variables";
import { fail, handleValidationError } from "../http/errors";

const loginSchema = z.object({
  username: z.string().min(1, "Username must not be blank"),
  password: z.string().min(1, "Password must not be blank"),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token must not be blank"),
});

const logoutSchema = z.object({
  refreshToken: z.string().optional(),
});

const registerSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(8).max(72),
  name: z.string().min(1),
  email: z.email(),
  permissionUpload: z.boolean().default(false),
  permissionDownload: z.boolean().default(false),
  permissionEditMetadata: z.boolean().default(false),
  permissionManageLibrary: z.boolean().default(false),
  permissionEmailBook: z.boolean().default(false),
  permissionDeleteBook: z.boolean().default(false),
  permissionAccessOpds: z.boolean().default(false),
  permissionSyncKoreader: z.boolean().default(false),
  permissionSyncKobo: z.boolean().default(false),
  permissionAdmin: z.boolean().default(false),
  permissionManageMetadataConfig: z.boolean().default(false),
  permissionAccessBookdrop: z.boolean().default(false),
  permissionAccessLibraryStats: z.boolean().default(false),
  permissionAccessUserStats: z.boolean().default(false),
  permissionAccessTaskManager: z.boolean().default(false),
  permissionManageGlobalPreferences: z.boolean().default(false),
  permissionManageIcons: z.boolean().default(false),
  permissionManageFonts: z.boolean().default(false),
  permissionBulkAutoFetchMetadata: z.boolean().default(false),
  permissionBulkCustomFetchMetadata: z.boolean().default(false),
  permissionBulkEditMetadata: z.boolean().default(false),
  permissionBulkRegenerateCover: z.boolean().default(false),
  permissionMoveOrganizeFiles: z.boolean().default(false),
  permissionBulkLockUnlockMetadata: z.boolean().default(false),
  permissionBulkResetBookloreReadProgress: z.boolean().default(false),
  permissionBulkResetKoReaderReadProgress: z.boolean().default(false),
  permissionBulkResetBookReadStatus: z.boolean().default(false),
  selectedLibraries: z.array(z.uuidv7()).default([]),
});

export const authRoutes = new Hono<{ Variables: AppVariables }>();

authRoutes.post(
  "/register",
  requireAdmin,
  zValidator("json", registerSchema, handleValidationError),
  async (c) => {
    const payload = c.req.valid("json");
    await registerUser(payload);
    return c.body(null, 204);
  },
);

authRoutes.post(
  "/login",
  zValidator("json", loginSchema, handleValidationError),
  async (c) => {
    const payload = c.req.valid("json");
    const tokenMap = await loginWithPassword(
      payload.username,
      payload.password,
    );
    return c.json(tokenMap, 200);
  },
);

authRoutes.post(
  "/refresh",
  zValidator("json", refreshSchema, handleValidationError),
  async (c) => {
    const payload = c.req.valid("json");
    const tokenMap = await refreshAccessToken(payload.refreshToken);
    return c.json(tokenMap, 200);
  },
);

authRoutes.post(
  "/logout",
  zValidator("json", logoutSchema, handleValidationError),
  async (c) => {
    const authUser = c.get("authUser");
    const payload = c.req.valid("json");
    await logout(authUser?.userId ?? null, payload?.refreshToken ?? null);
    return c.body(null, 204);
  },
);

authRoutes.get("/remote", async (c) => {
  if (!env.remoteAuthEnabled) {
    fail(203, "Remote login is disabled");
  }

  const name = c.req.header(env.remoteAuthHeaderName);
  const username = c.req.header(env.remoteAuthHeaderUser);
  const email = c.req.header(env.remoteAuthHeaderEmail);

  const tokenMap = await loginRemote(
    name ?? undefined,
    username ?? undefined,
    email ?? undefined,
  );
  return c.json(tokenMap, 200);
});
