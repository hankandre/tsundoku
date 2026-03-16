import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppVariables, AuthUser } from "../types/app-variables";
import { fail, handleValidationError } from "../http/errors";
import { requireAdmin } from "../middleware/auth-middleware";
import {
  getAuditLogs,
  getDistinctUsernames,
} from "../services/audit-service";

const getAuthUser = (c: import("hono").Context): AuthUser => {
  const authUser = c.get("authUser");
  if (!authUser) {
    fail(401, "Unauthorized");
  }
  return authUser as AuthUser;
};

const auditLogQuerySchema = z.object({
  page: z.string().default("0"),
  size: z.string().default("25"),
  action: z.string().optional(),
  userId: z.string().optional(),
  username: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const auditLogRoutes = new Hono<{ Variables: AppVariables }>();

auditLogRoutes.get("/", requireAdmin, zValidator("query", auditLogQuerySchema, handleValidationError), async (c) => {
  const { page, size, action, userId, username, from, to } = c.req.valid("query");
  
  const result = await getAuditLogs({
    page: parseInt(page),
    size: Math.min(parseInt(size), 100),
    action,
    userId,
    username,
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
  });
  
  return c.json({
    content: result.logs,
    totalElements: result.total,
    totalPages: Math.ceil(result.total / parseInt(size)),
    number: parseInt(page),
    size: parseInt(size),
  }, 200);
});

auditLogRoutes.get("/usernames", requireAdmin, async (c) => {
  const usernames = await getDistinctUsernames();
  return c.json(usernames, 200);
});
