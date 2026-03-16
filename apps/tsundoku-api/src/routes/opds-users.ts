import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppVariables } from "../types/app-variables";
import { fail } from "../http/errors";
import { getOpdsUsers, createOpdsUser, deleteOpdsUser, updateOpdsUser } from "../services/opds-service";

const getAuthUser = (c: import("hono").Context) => {
  const authUser = c.get("authUser");
  if (!authUser) {
    fail(401, "Unauthorized");
  }
  return authUser;
};

const opdsUserIdParamSchema = z.object({
  id: z.string(),
});

const opdsUserCreateSchema = z.object({
  username: z.string(),
  password: z.string(),
  sortOrder: z.enum(["title", "author", "last_modified", "random"]).optional(),
});

const opdsUserUpdateSchema = z.object({
  username: z.string().optional(),
  sortOrder: z.enum(["title", "author", "last_modified", "random"]).optional(),
});

export const opdsUserRoutes = new Hono<{ Variables: AppVariables }>();

opdsUserRoutes.get("/", async (c) => {
  const authUser = getAuthUser(c);
  if (!authUser.isAdmin) {
    fail(403, "Forbidden");
  }

  const users = await getOpdsUsers();
  return c.json(users);
});

opdsUserRoutes.post("/", zValidator("json", opdsUserCreateSchema, handleValidationError), async (c) => {
  const authUser = getAuthUser(c);
  if (!authUser.isAdmin) {
    fail(403, "Forbidden");
  }

  const input = c.req.valid("json");
  const user = await createOpdsUser(input, authUser.userId);
  return c.json(user, 201);
});

opdsUserRoutes.delete("/:id", zValidator("param", opdsUserIdParamSchema, handleValidationError), async (c) => {
  const authUser = getAuthUser(c);
  if (!authUser.isAdmin) {
    fail(403, "Forbidden");
  }

  const { id } = c.req.valid("param");
  await deleteOpdsUser(id);
  return c.body(null, 204);
});

opdsUserRoutes.patch("/:id", zValidator("param", opdsUserIdParamSchema, handleValidationError), zValidator("json", opdsUserUpdateSchema, handleValidationError), async (c) => {
  const authUser = getAuthUser(c);
  if (!authUser.isAdmin) {
    fail(403, "Forbidden");
  }

  const { id } = c.req.valid("param");
  const input = c.req.valid("json");
  const user = await updateOpdsUser(id, input);
  return c.json(user);
});

function handleValidationError(err: unknown) {
  if (err && typeof err === "object" && "issues" in err) {
    const issues = (err as { issues: Array<{ path: string; message: string }> }).issues;
    const messages = issues.map((i) => `${i.path}: ${i.message}`);
    fail(400, messages.join(", "));
  }
  fail(400, "Validation failed");
}
