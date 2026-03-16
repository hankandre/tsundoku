import type { MiddlewareHandler } from "hono";
import type { AppVariables } from "../types/app-variables";

export const requestContext: MiddlewareHandler<{ Variables: AppVariables }> = async (
  c,
  next,
) => {
  const incoming = c.req.header("x-request-id");
  const requestId = incoming && incoming.trim().length > 0 ? incoming : crypto.randomUUID();

  c.set("requestId", requestId);
  c.header("x-request-id", requestId);

  await next();
};
