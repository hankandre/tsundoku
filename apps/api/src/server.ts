import { app } from "./app.ts";
import { env } from "./env.ts";
import { logger } from "./logger.ts";
import { websocket } from "./ws/index.ts";
import { startCron } from "./services/cron.ts";
import { startBookdropWatcher } from "./services/bookdrop.ts";
import { startWorkers } from "./services/workers.ts";

const server = Bun.serve({
  port: env.BOOKLORE_PORT,
  fetch: app.fetch,
  websocket,
});

startWorkers();
startCron();
if (env.BOOKDROP_PATH) {
  void startBookdropWatcher(env.BOOKDROP_PATH);
}

logger.info(
  { port: server.port, env: env.NODE_ENV, version: env.APP_VERSION },
  "tsundoku api listening",
);
