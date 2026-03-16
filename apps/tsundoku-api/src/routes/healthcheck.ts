import { Hono } from "hono";
import { env } from "../config/env";
import { successResponse } from "../types/success-response";
import type { AppVariables } from "../types/app-variables";

export const healthcheckRoutes = new Hono<{ Variables: AppVariables }>();

healthcheckRoutes.get("/", (c) => {
  const now = new Date().toISOString();

  const payload = successResponse(200, "Pong", {
    status: "UP",
    message: "Application is running smoothly.",
    version: env.appVersion,
    timestamp: now,
  });

  return c.json(payload, 200);
});
