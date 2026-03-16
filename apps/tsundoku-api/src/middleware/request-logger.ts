import type { MiddlewareHandler } from "hono";
import { logger } from "../config/logger";
import type { AppVariables } from "../types/app-variables";

export const requestLogger: MiddlewareHandler<{ Variables: AppVariables }> = async (
  c,
  next,
) => {
  const start = performance.now();
  await next();
  const durationMs = Number((performance.now() - start).toFixed(2));

  logger.info({
    requestId: c.get("requestId"),
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    durationMs,
  });
};
