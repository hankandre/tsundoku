import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppVariables } from "../types/app-variables";
import { fail, handleValidationError } from "../http/errors";
import { requireAdmin } from "../middleware/auth-middleware";
import {
  buildOidcAppRedirectUri,
  completeOidcAuthorizationCodeFlow,
  processOidcBackchannelLogout,
} from "../services/oidc-auth-flow-service";
import {
  getAllOidcGroupMappings,
  createOidcGroupMapping,
  updateOidcGroupMapping,
  deleteOidcGroupMapping,
} from "../services/oidc-service";

const oidcCallbackSchema = z.object({
  code: z.string(),
  codeVerifier: z.string(),
  redirectUri: z.string(),
  nonce: z.string(),
  state: z.string(),
});

const oidcRedirectSchema = z.object({
  code: z.string(),
  code_verifier: z.string(),
  redirect_uri: z.string(),
  nonce: z.string(),
  state: z.string(),
  app_redirect_uri: z.string(),
});

const oidcMobileCallbackSchema = z.object({
  code: z.string(),
  code_verifier: z.string(),
  redirect_uri: z.string(),
  nonce: z.string(),
  state: z.string(),
});

const oidcGroupMappingCreateSchema = z.object({
  groupName: z.string(),
  permissionAdmin: z.boolean().optional(),
  permissionManageLibrary: z.boolean().optional(),
});

const oidcGroupMappingUpdateSchema = z.object({
  groupName: z.string().optional(),
  permissionAdmin: z.boolean().optional(),
  permissionManageLibrary: z.boolean().optional(),
});

const oidcGroupMappingIdSchema = z.object({
  id: z.string(),
});

const stateStore = new Map<string, { createdAt: number }>();
const STATE_TTL_MS = 5 * 60 * 1000;

const generateState = (): string => {
  const state = Bun.randomUUIDv7();
  stateStore.set(state, { createdAt: Date.now() });
  return state;
};

const validateAndConsumeState = (state: string): void => {
  const entry = stateStore.get(state);
  if (!entry) {
    fail(400, "Invalid or expired state");
    return;
  }

  const createdAt = entry.createdAt;

  if (Date.now() - createdAt > STATE_TTL_MS) {
    stateStore.delete(state);
    fail(400, "State expired");
  }

  stateStore.delete(state);
};

export const oidcAuthRoutes = new Hono<{ Variables: AppVariables }>();

oidcAuthRoutes.get("/state", async (c) => {
  const state = generateState();
  return c.json({ state });
});

oidcAuthRoutes.post(
  "/callback",
  zValidator("json", oidcCallbackSchema, handleValidationError),
  async (c) => {
    const { code, codeVerifier, redirectUri, nonce, state } = c.req.valid("json");

    validateAndConsumeState(state);

    const sessionPayload = await completeOidcAuthorizationCodeFlow({
      code,
      codeVerifier,
      redirectUri,
      nonce,
    });

    return c.json(sessionPayload, 200);
  }
);

oidcAuthRoutes.get(
  "/redirect",
  zValidator("query", oidcRedirectSchema, handleValidationError),
  async (c) => {
    const { code, code_verifier, redirect_uri, nonce, state, app_redirect_uri } =
      c.req.valid("query");

    validateAndConsumeState(state);

    const redirectTarget = await buildOidcAppRedirectUri({
      code,
      codeVerifier: code_verifier,
      redirectUri: redirect_uri,
      nonce,
      appRedirectUri: app_redirect_uri,
    });

    return c.redirect(redirectTarget, 302);
  }
);

oidcAuthRoutes.post(
  "/mobile/callback",
  zValidator("query", oidcMobileCallbackSchema, handleValidationError),
  async (c) => {
    const { code, code_verifier, redirect_uri, nonce, state } = c.req.valid("query");

    validateAndConsumeState(state);

    const sessionPayload = await completeOidcAuthorizationCodeFlow({
      code,
      codeVerifier: code_verifier,
      redirectUri: redirect_uri,
      nonce,
    });

    return c.json(sessionPayload, 200);
  }
);

oidcAuthRoutes.post("/backchannel-logout", async (c) => {
  const formData = await c.req.formData();
  const logoutToken = formData.get("logout_token");
  
  if (!logoutToken || typeof logoutToken !== "string") {
    return c.body(null, 400);
  }

  await processOidcBackchannelLogout(logoutToken);
  return c.body(null, 204);
});

export const oidcGroupMappingRoutes = new Hono<{ Variables: AppVariables }>();

oidcGroupMappingRoutes.use("*", requireAdmin);

oidcGroupMappingRoutes.get("/", async (c) => {
  const mappings = await getAllOidcGroupMappings();
  return c.json(mappings);
});

oidcGroupMappingRoutes.post(
  "/",
  zValidator("json", oidcGroupMappingCreateSchema, handleValidationError),
  async (c) => {
    const input = c.req.valid("json");
    const mapping = await createOidcGroupMapping(input);
    return c.json(mapping, 201);
  }
);

oidcGroupMappingRoutes.put(
  "/:id",
  zValidator("param", oidcGroupMappingIdSchema, handleValidationError),
  zValidator("json", oidcGroupMappingUpdateSchema, handleValidationError),
  async (c) => {
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");
    const mapping = await updateOidcGroupMapping(id, input);
    return c.json(mapping);
  }
);

oidcGroupMappingRoutes.delete(
  "/:id",
  zValidator("param", oidcGroupMappingIdSchema, handleValidationError),
  async (c) => {
    const { id } = c.req.valid("param");
    await deleteOidcGroupMapping(id);
    return c.body(null, 204);
  }
);
