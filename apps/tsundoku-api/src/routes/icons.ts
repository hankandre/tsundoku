import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppVariables } from "../types/app-variables";
import { fail } from "../http/errors";
import { saveSvgIcon, saveBatchSvgIcons, getSvgIcon, getIconNames, deleteSvgIcon, getAllIconsContent } from "../services/icon-service";

const getAuthUser = (c: import("hono").Context) => {
  const authUser = c.get("authUser");
  if (!authUser) {
    fail(401, "Unauthorized");
  }
  return authUser;
};

const svgIconCreateSchema = z.object({
  name: z.string().min(1),
  content: z.string().min(1),
});

const svgIconBatchSchema = z.object({
  icons: z.array(z.object({
    name: z.string().min(1),
    content: z.string().min(1),
  })),
});

const iconNamesQuerySchema = z.object({
  page: z.coerce.number().int().min(0).default(0),
  size: z.coerce.number().int().min(1).max(100).default(50),
});

const svgNameParamSchema = z.object({
  svgName: z.string(),
});

export const iconRoutes = new Hono<{ Variables: AppVariables }>();

iconRoutes.post("/", zValidator("json", svgIconCreateSchema, handleValidationError), async (c) => {
  const authUser = getAuthUser(c);
  if (!authUser.isAdmin) {
    fail(403, "Forbidden");
  }

  const { name, content } = c.req.valid("json");
  await saveSvgIcon(name, content);

  return c.text("", 200);
});

iconRoutes.post("/batch", zValidator("json", svgIconBatchSchema, handleValidationError), async (c) => {
  const authUser = getAuthUser(c);
  if (!authUser.isAdmin) {
    fail(403, "Forbidden");
  }

  const { icons } = c.req.valid("json");
  const response = await saveBatchSvgIcons(icons);

  return c.json(response);
});

iconRoutes.get("/:svgName/content", zValidator("param", svgNameParamSchema, handleValidationError), async (c) => {
  const { svgName } = c.req.valid("param");
  const svgContent = await getSvgIcon(svgName);

  if (!svgContent) {
    fail(404, "Icon not found");
    return c.body(null, 404);
  }

  return c.text(svgContent, 200, {
    "Content-Type": "image/svg+xml",
  });
});

iconRoutes.get("/", zValidator("query", iconNamesQuerySchema, handleValidationError), async (c) => {
  const { page, size } = c.req.valid("query");
  const result = await getIconNames(page, size);

  return c.json({
    content: result.content,
    totalElements: result.totalElements,
    totalPages: result.totalPages,
    page,
    size,
  });
});

iconRoutes.delete("/:svgName", zValidator("param", svgNameParamSchema, handleValidationError), async (c) => {
  const authUser = getAuthUser(c);
  if (!authUser.isAdmin) {
    fail(403, "Forbidden");
  }

  const { svgName } = c.req.valid("param");
  await deleteSvgIcon(svgName);

  return c.text("", 200);
});

iconRoutes.get("/all/content", async (c) => {
  const icons = await getAllIconsContent();
  return c.json(icons);
});

function handleValidationError(err: unknown) {
  if (err && typeof err === "object" && "issues" in err) {
    const issues = (err as { issues: Array<{ path: string; message: string }> }).issues;
    const messages = issues.map((i) => `${i.path}: ${i.message}`);
    fail(400, messages.join(", "));
  }
  fail(400, "Validation failed");
}
