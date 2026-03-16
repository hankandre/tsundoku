import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppVariables } from "../types/app-variables";
import { fail } from "../http/errors";
import { requireAdmin } from "../middleware/auth-middleware";
import { getAppSettings, updateSetting } from "../services/app-settings-service";
import { handleValidationError } from "../http/errors";
import { testOidcConnection } from "../services/oidc-diagnostic-service";

const settingRequestSchema = z.object({
  name: z.string(),
  value: z.string(),
});

const updateSettingsSchema = z.array(settingRequestSchema);

const oidcClaimMappingSchema = z.object({
  username: z.string().optional(),
  name: z.string().optional(),
  email: z.string().optional(),
  groups: z.string().optional(),
});

const oidcProviderDetailsSchema = z.object({
  providerName: z.string().optional(),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  issuerUri: z.url(),
  scopes: z.string().optional(),
  claimMapping: oidcClaimMappingSchema.optional(),
});

export const settingsRoutes = new Hono<{ Variables: AppVariables }>();

settingsRoutes.get("/", async (c) => {
  const settings = await getAppSettings();
  return c.json(settings, 200);
});

settingsRoutes.put("/", requireAdmin, zValidator("json", updateSettingsSchema, handleValidationError), async (c) => {
  const settings = await c.req.valid("json");
  
  for (const setting of settings) {
    const parts = setting.name.split(".");
    if (parts.length !== 2) {
      fail(400, "Invalid setting name format. Expected 'category.name'");
    }
    const [category, name] = parts;
    await updateSetting(category, name, setting.value);
  }
  
  return c.body(null, 204);
});

settingsRoutes.post(
  "/oidc/test",
  requireAdmin,
  zValidator("json", oidcProviderDetailsSchema, handleValidationError),
  async (c) => {
    const providerDetails = c.req.valid("json");
    const result = await testOidcConnection(providerDetails);
    return c.json(result, 200);
  },
);
