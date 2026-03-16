import { Hono } from "hono";
import type { AppVariables } from "../types/app-variables";
import { getPublicSettings } from "../services/app-settings-service";

export const publicSettingsRoutes = new Hono<{ Variables: AppVariables }>();

publicSettingsRoutes.get("/", async (c) => {
  const settings = await getPublicSettings();
  return c.json(settings, 200);
});
