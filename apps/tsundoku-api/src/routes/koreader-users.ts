import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppVariables, AuthUser } from "../types/app-variables";
import { fail, handleValidationError } from "../http/errors";
import {
  getKoreaderUser,
  upsertKoreaderUser,
  toggleSync,
  toggleSyncProgressWithBooklore,
} from "../services/koreader-service";

const getAuthUser = (c: import("hono").Context): AuthUser => {
  const authUser = c.get("authUser");
  if (!authUser) {
    fail(401, "Unauthorized");
  }
  return authUser as AuthUser;
};

const koreaderUserSchema = z.object({
  username: z.string(),
  password: z.string(),
});

export const koreaderUserRoutes = new Hono<{ Variables: AppVariables }>();

koreaderUserRoutes.get("/me", async (c) => {
  const authUser = getAuthUser(c);
  
  const user = await getKoreaderUser(authUser.userId);
  if (!user) {
    fail(404, "KOReader user not found");
  }
  
  return c.json(user, 200);
});

koreaderUserRoutes.put("/me", zValidator("json", koreaderUserSchema, handleValidationError), async (c) => {
  const authUser = getAuthUser(c);
  const { username, password } = c.req.valid("json");
  
  const md5 = await crypto.subtle.digest("MD5", new TextEncoder().encode(password))
    .then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join(""));
  
  const user = await upsertKoreaderUser(authUser.userId, username, password, md5);
  return c.json(user, 200);
});

koreaderUserRoutes.patch("/me/sync", async (c) => {
  const authUser = getAuthUser(c);
  const enabled = c.req.query("enabled") === "true";
  
  await toggleSync(authUser.userId, enabled);
  return c.body(null, 204);
});

koreaderUserRoutes.patch("/me/sync-progress-with-booklore", async (c) => {
  const authUser = getAuthUser(c);
  const enabled = c.req.query("enabled") === "true";
  
  await toggleSyncProgressWithBooklore(authUser.userId, enabled);
  return c.body(null, 204);
});
