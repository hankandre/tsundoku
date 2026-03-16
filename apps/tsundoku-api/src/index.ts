import { app } from "./app";
import { env } from "./config/env";
import { startLibraryWatchers, reconcileLibraryOnStartup } from "./services/tasks/task-watch-service";

Bun.serve({
  port: env.port,
  fetch: app.fetch,
});

console.log(`booklore-api-bun listening on :${env.port}`);

if (env.nodeEnv !== "test") {
  startLibraryWatchers()
    .then(() => {
      return reconcileLibraryOnStartup();
    })
    .catch((error) => {
      console.error("Failed to start library watchers:", error);
    });
}
