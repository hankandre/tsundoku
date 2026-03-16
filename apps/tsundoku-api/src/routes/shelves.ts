import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppVariables, AuthUser } from "../types/app-variables";
import { fail, assertIsDefined, handleValidationError } from "../http/errors";
import {
  getAllShelvesForUser,
  getShelfById,
  createShelf,
  updateShelf,
  deleteShelf,
  checkShelfAccess,
  checkShelfOwnership,
  getBooksByShelfId,
  type ShelfRow,
} from "../services/shelf-service";

const createShelfSchema = z.object({
  name: z.string().min(1),
  icon: z.string().optional(),
  iconType: z.string().optional(),
  isPublic: z.boolean().optional(),
});

const updateShelfSchema = z.object({
  name: z.string().min(1).optional(),
  icon: z.string().optional(),
  iconType: z.string().optional(),
  isPublic: z.boolean().optional(),
});

interface ShelfResponse {
  id: string;
  userId: string;
  name: string;
  sort: string | null;
  icon: string;
  iconType: string | null;
  isPublic: boolean;
  bookCount?: number;
}

const getAuthUser = (c: import("hono").Context): AuthUser => {
  const authUser = c.get("authUser");
  if (!authUser) {
    fail(401, "Unauthorized");
  }
  return authUser as AuthUser;
};

const requireShelfAccess = (shelfIdParam: string = "shelfId") => {
  return async (c: import("hono").Context, next: () => Promise<void>) => {
    const authUser = getAuthUser(c);

    const shelfIdRaw = c.req.param(shelfIdParam);
    const parsed = z.uuidv7().safeParse(shelfIdRaw);
    if (!parsed.success) {
      fail(400, "Invalid shelf ID");
    }

    const hasAccess = await checkShelfAccess(
      shelfIdRaw as string,
      authUser.userId,
      authUser.isAdmin
    );
    if (!hasAccess) {
      fail(403, "Access denied to this shelf");
    }

    await next();
  };
};

const requireShelfOwnership = (shelfIdParam: string = "shelfId") => {
  return async (c: import("hono").Context, next: () => Promise<void>) => {
    const authUser = getAuthUser(c);

    const shelfIdRaw = c.req.param(shelfIdParam);
    const parsed = z.uuidv7().safeParse(shelfIdRaw);
    if (!parsed.success) {
      fail(400, "Invalid shelf ID");
    }

    const isOwner = await checkShelfOwnership(shelfIdRaw as string, authUser.userId);
    if (!isOwner) {
      fail(403, "Only the shelf owner can perform this action");
    }

    await next();
  };
};

export const shelfRoutes = new Hono<{ Variables: AppVariables }>();

shelfRoutes.get("/", async (c) => {
  const authUser = getAuthUser(c);

  const shelves = await getAllShelvesForUser(authUser.userId);

  const results: ShelfResponse[] = shelves.map((shelf: ShelfRow) => ({
    id: shelf.id,
    userId: shelf.userId,
    name: shelf.name,
    sort: shelf.sort,
    icon: shelf.icon,
    iconType: shelf.iconType,
    isPublic: shelf.isPublic,
  }));

  return c.json(results, 200);
});

shelfRoutes.get("/:shelfId", requireShelfAccess("shelfId"), async (c) => {
  const shelfIdRaw = c.req.param("shelfId");
  const shelfId = shelfIdRaw as string;

  const shelf = await getShelfById(shelfId);
  assertIsDefined(shelf, `Shelf not found: ${shelfId}`);

  const response: ShelfResponse = {
    id: shelf.id,
    userId: shelf.userId,
    name: shelf.name,
    sort: shelf.sort,
    icon: shelf.icon,
    iconType: shelf.iconType,
    isPublic: shelf.isPublic,
  };

  return c.json(response, 200);
});

shelfRoutes.post("/", zValidator("json", createShelfSchema, handleValidationError), async (c) => {
  const authUser = getAuthUser(c);

  const payload = c.req.valid("json");

  const shelf = await createShelf(payload, authUser.userId, authUser.isAdmin);

  const response: ShelfResponse = {
    id: shelf.id,
    userId: shelf.userId,
    name: shelf.name,
    sort: shelf.sort,
    icon: shelf.icon,
    iconType: shelf.iconType,
    isPublic: shelf.isPublic,
  };

  return c.json(response, 201);
});

shelfRoutes.put("/:shelfId", requireShelfOwnership("shelfId"), zValidator("json", updateShelfSchema, handleValidationError), async (c) => {
  const shelfIdRaw = c.req.param("shelfId");
  const shelfId = shelfIdRaw as string;

  const payload = c.req.valid("json");

  const authUser = getAuthUser(c);

  const shelf = await updateShelf(shelfId, payload, authUser.userId, authUser.isAdmin);

  const response: ShelfResponse = {
    id: shelf.id,
    userId: shelf.userId,
    name: shelf.name,
    sort: shelf.sort,
    icon: shelf.icon,
    iconType: shelf.iconType,
    isPublic: shelf.isPublic,
  };

  return c.json(response, 200);
});

shelfRoutes.delete("/:shelfId", requireShelfOwnership("shelfId"), async (c) => {
  const shelfIdRaw = c.req.param("shelfId");
  const shelfId = shelfIdRaw as string;

  await deleteShelf(shelfId);

  return c.body(null, 204);
});

shelfRoutes.get("/:shelfId/books", requireShelfAccess("shelfId"), async (c) => {
  const shelfIdRaw = c.req.param("shelfId");
  const shelfId = shelfIdRaw as string;

  const books = await getBooksByShelfId(shelfId);
  return c.json(books, 200);
});
