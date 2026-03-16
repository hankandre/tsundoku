import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppVariables } from "../types/app-variables";
import { fail } from "../http/errors";
import { getFoldersAtPath } from "../services/path-service";

const getAuthUser = (c: import("hono").Context) => {
  const authUser = c.get("authUser");
  if (!authUser) {
    fail(401, "Unauthorized");
  }
  return authUser;
};

const pathQuerySchema = z.object({
  path: z.string(),
});

export const pathRoutes = new Hono<{ Variables: AppVariables }>();

pathRoutes.get("/", zValidator("query", pathQuerySchema, handleValidationError), async (c) => {
  const authUser = getAuthUser(c);

  if (!authUser.isAdmin && !authUser.canManageLibrary) {
    fail(403, "Forbidden");
  }

  const { path } = c.req.valid("query");
  const folders = await getFoldersAtPath(path);

  return c.json(folders);
});

function handleValidationError(err: unknown) {
  if (err && typeof err === "object" && "issues" in err) {
    const issues = (err as { issues: Array<{ path: string; message: string }> }).issues;
    const messages = issues.map((i) => `${i.path}: ${i.message}`);
    fail(400, messages.join(", "));
  }
  fail(400, "Validation failed");
}
