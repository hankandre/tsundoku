import { Hono } from "hono";
import { env } from "../env.ts";

export const healthRoutes = new Hono()
  .get("/health", (c) =>
    c.json({
      status: "ok",
      version: env.APP_VERSION,
      timestamp: new Date().toISOString(),
    }),
  )
  // Spring's actuator equivalent (subset). Useful for k8s probes during cutover.
  .get("/health/ready", (c) => c.json({ status: "ok" }))
  .get("/health/live", (c) => c.json({ status: "ok" }));
