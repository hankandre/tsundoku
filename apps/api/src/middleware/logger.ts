import { createMiddleware } from "hono/factory";
import { logger } from "../logger.ts";

export const httpLogger = createMiddleware(async (c, next) => {
  const start = performance.now();
  await next();
  const ms = (performance.now() - start).toFixed(1);
  logger.info(
    {
      reqId: c.var.requestId,
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durationMs: ms,
    },
    "request",
  );
});
