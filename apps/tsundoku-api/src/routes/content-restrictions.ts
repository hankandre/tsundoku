import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppVariables } from "../types/app-variables";
import { fail } from "../http/errors";
import { getUserRestrictions, addRestriction, updateRestrictions, deleteRestriction, deleteAllUserRestrictions } from "../services/content-restriction-service";

const getAuthUser = (c: import("hono").Context) => {
  const authUser = c.get("authUser");
  if (!authUser) {
    fail(401, "Unauthorized");
  }
  return authUser;
};

const userIdParamSchema = z.object({
  userId: z.string(),
});

const restrictionIdParamSchema = z.object({
  userId: z.string(),
  restrictionId: z.string(),
});

const restrictionSchema = z.object({
  restrictionType: z.string(),
  mode: z.string(),
  value: z.string(),
});

const restrictionsListSchema = z.array(restrictionSchema);

export const contentRestrictionRoutes = new Hono<{ Variables: AppVariables }>();

contentRestrictionRoutes.get("/:userId/content-restrictions", zValidator("param", userIdParamSchema, handleValidationError), async (c) => {
  const authUser = getAuthUser(c);
  const { userId } = c.req.valid("param");

  if (!authUser.isAdmin && authUser.userId !== userId) {
    fail(403, "Forbidden");
  }

  const restrictions = await getUserRestrictions(userId);
  return c.json(restrictions);
});

contentRestrictionRoutes.post("/:userId/content-restrictions", zValidator("param", userIdParamSchema, handleValidationError), zValidator("json", restrictionSchema, handleValidationError), async (c) => {
  const authUser = getAuthUser(c);
  if (!authUser.isAdmin) {
    fail(403, "Forbidden");
  }

  const { userId } = c.req.valid("param");
  const restriction = c.req.valid("json");
  const created = await addRestriction(userId, restriction, authUser.userId);

  return c.json(created, 201);
});

contentRestrictionRoutes.put("/:userId/content-restrictions", zValidator("param", userIdParamSchema, handleValidationError), zValidator("json", restrictionsListSchema, handleValidationError), async (c) => {
  const authUser = getAuthUser(c);
  if (!authUser.isAdmin) {
    fail(403, "Forbidden");
  }

  const { userId } = c.req.valid("param");
  const restrictions = c.req.valid("json");
  const updated = await updateRestrictions(userId, restrictions, authUser.userId);

  return c.json(updated);
});

contentRestrictionRoutes.delete("/:userId/content-restrictions/:restrictionId", zValidator("param", restrictionIdParamSchema, handleValidationError), async (c) => {
  const authUser = getAuthUser(c);
  if (!authUser.isAdmin) {
    fail(403, "Forbidden");
  }

  const { restrictionId } = c.req.valid("param");
  await deleteRestriction(restrictionId);

  return c.body(null, 204);
});

contentRestrictionRoutes.delete("/:userId/content-restrictions", zValidator("param", userIdParamSchema, handleValidationError), async (c) => {
  const authUser = getAuthUser(c);
  if (!authUser.isAdmin) {
    fail(403, "Forbidden");
  }

  const { userId } = c.req.valid("param");
  await deleteAllUserRestrictions(userId);

  return c.body(null, 204);
});

function handleValidationError(err: unknown) {
  if (err && typeof err === "object" && "issues" in err) {
    const issues = (err as { issues: Array<{ path: string; message: string }> }).issues;
    const messages = issues.map((i) => `${i.path}: ${i.message}`);
    fail(400, messages.join(", "));
  }
  fail(400, "Validation failed");
}
