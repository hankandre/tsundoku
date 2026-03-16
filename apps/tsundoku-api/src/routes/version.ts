import { Hono } from "hono";
import { getChangelogSinceCurrent, getVersionInfo } from "../services/version-service";
import type { AppVariables } from "../types/app-variables";

export const versionRoutes = new Hono<{ Variables: AppVariables }>();

versionRoutes.get("/", async (c) => {
  const payload = await getVersionInfo();
  return c.json(payload, 200);
});

versionRoutes.get("/changelog", async (c) => {
  const payload = await getChangelogSinceCurrent();
  return c.json(payload, 200);
});
