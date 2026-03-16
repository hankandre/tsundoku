import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppVariables, AuthUser } from "../types/app-variables";
import { fail, handleValidationError } from "../http/errors";
import {
  getMagicShelvesByUser,
  getMagicShelfById,
  createMagicShelf,
  deleteMagicShelf,
} from "../services/magic-shelf-service";

const getAuthUser = (c: import("hono").Context): AuthUser => {
  const authUser = c.get("authUser");
  if (!authUser) {
    fail(401, "Unauthorized");
  }
  return authUser as AuthUser;
};

const magicShelfSchema = z.object({
  name: z.string().min(1),
  icon: z.string().default("book"),
  filterJson: z.string(),
});

const shelfIdParamSchema = z.object({
  id: z.string(),
});

const validateShelfId = zValidator("param", shelfIdParamSchema, handleValidationError);

export const magicShelfRoutes = new Hono<{ Variables: AppVariables }>();

magicShelfRoutes.get("/", async (c) => {
  const authUser = getAuthUser(c);
  const shelves = await getMagicShelvesByUser(authUser.userId);
  return c.json(shelves, 200);
});

magicShelfRoutes.get("/:id", validateShelfId, async (c) => {
  const authUser = getAuthUser(c);
  const { id } = c.req.valid("param");
  
  const shelf = await getMagicShelfById(id, authUser.userId);
  if (!shelf) {
    fail(404, `Magic shelf not found: ${id}`);
  }
  
  return c.json(shelf, 200);
});

magicShelfRoutes.post("/", zValidator("json", magicShelfSchema, handleValidationError), async (c) => {
  const authUser = getAuthUser(c);
  const input = c.req.valid("json");
  
  const shelf = await createMagicShelf(authUser.userId, input);
  return c.json(shelf, 200);
});

magicShelfRoutes.delete("/:id", validateShelfId, async (c) => {
  const authUser = getAuthUser(c);
  const { id } = c.req.valid("param");
  
  await deleteMagicShelf(id, authUser.userId);
  return c.body(null, 204);
});
