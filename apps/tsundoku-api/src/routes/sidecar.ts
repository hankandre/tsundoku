import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppVariables } from "../types/app-variables";
import { fail } from "../http/errors";
import { getSidecarContent, getSyncStatus, exportToSidecar, importFromSidecar, bulkExport, bulkImport } from "../services/sidecar-service";

const getAuthUser = (c: import("hono").Context) => {
  const authUser = c.get("authUser");
  if (!authUser) {
    fail(401, "Unauthorized");
  }
  return authUser;
};

const bookIdParamSchema = z.object({
  bookId: z.string(),
});

const libraryIdParamSchema = z.object({
  libraryId: z.string(),
});

export const sidecarRoutes = new Hono<{ Variables: AppVariables }>();

sidecarRoutes.get("/books/:bookId/sidecar", zValidator("param", bookIdParamSchema, handleValidationError), async (c) => {
  const { bookId } = c.req.valid("param");
  const sidecar = await getSidecarContent(bookId);
  
  if (!sidecar) {
    fail(404, "Sidecar file not found");
  }
  
  return c.json(sidecar);
});

sidecarRoutes.get("/books/:bookId/sidecar/status", zValidator("param", bookIdParamSchema, handleValidationError), async (c) => {
  const { bookId } = c.req.valid("param");
  const status = await getSyncStatus(bookId);
  
  return c.json({ status });
});

sidecarRoutes.post("/books/:bookId/sidecar/export", zValidator("param", bookIdParamSchema, handleValidationError), async (c) => {
  const authUser = getAuthUser(c);
  if (!authUser.isAdmin) {
    fail(403, "Forbidden");
  }
  
  const { bookId } = c.req.valid("param");
  await exportToSidecar(bookId);
  
  return c.json({ message: "Sidecar metadata exported successfully" });
});

sidecarRoutes.post("/books/:bookId/sidecar/import", zValidator("param", bookIdParamSchema, handleValidationError), async (c) => {
  const authUser = getAuthUser(c);
  if (!authUser.isAdmin) {
    fail(403, "Forbidden");
  }
  
  const { bookId } = c.req.valid("param");
  await importFromSidecar(bookId);
  
  return c.json({ message: "Sidecar metadata imported successfully" });
});

sidecarRoutes.post("/libraries/:libraryId/sidecar/export-all", zValidator("param", libraryIdParamSchema, handleValidationError), async (c) => {
  const authUser = getAuthUser(c);
  if (!authUser.isAdmin) {
    fail(403, "Forbidden");
  }
  
  const { libraryId } = c.req.valid("param");
  const exported = await bulkExport(libraryId);
  
  return c.json({ message: "Bulk export completed", exported });
});

sidecarRoutes.post("/libraries/:libraryId/sidecar/import-all", zValidator("param", libraryIdParamSchema, handleValidationError), async (c) => {
  const authUser = getAuthUser(c);
  if (!authUser.isAdmin) {
    fail(403, "Forbidden");
  }
  
  const { libraryId } = c.req.valid("param");
  const imported = await bulkImport(libraryId);
  
  return c.json({ message: "Bulk import completed", imported });
});

function handleValidationError(err: unknown) {
  if (err && typeof err === "object" && "issues" in err) {
    const issues = (err as { issues: Array<{ path: string; message: string }> }).issues;
    const messages = issues.map((i) => `${i.path}: ${i.message}`);
    fail(400, messages.join(", "));
  }
  fail(400, "Validation failed");
}
