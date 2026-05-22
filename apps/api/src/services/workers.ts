import { startWorker } from "./queue.ts";
import { scanLibrary, ingestFile } from "./scan.ts";
import { autoRefresh } from "./metadata-refresh.ts";
import { sendBookByEmail } from "./email.ts";
import { logger } from "../logger.ts";
import type { Worker } from "bullmq";

const workers: Worker[] = [];

/**
 * Spawn all background workers. Called once from server.ts. Each worker holds
 * a dedicated Redis connection (BullMQ requirement for blocking commands).
 */
export function startWorkers(): void {
  workers.push(
    startWorker<"library-scan">(
      "library-scan",
      async (job) => {
        const result = await scanLibrary(job.data.libraryId, (progress, detail) => {
          // BullMQ accepts number | object — pass both so listeners get the
          // human-readable detail string alongside the 0..1 progress.
          void job.updateProgress({ progress, detail });
        });
        logger.info({ result, jobId: job.id }, "library-scan completed");
        return result;
      },
      { concurrency: 2 },
    ),
  );

  workers.push(
    startWorker<"book-ingest">(
      "book-ingest",
      async (job) => {
        return ingestFile(job.data);
      },
      { concurrency: 4 },
    ),
  );

  workers.push(
    startWorker<"metadata-refresh">(
      "metadata-refresh",
      async (job) => {
        const result = await autoRefresh(job.data.bookId);
        await job.updateProgress({ progress: 1, detail: result.reason ?? "applied" });
        return result;
      },
      // Keep concurrency low to be polite to external providers; raise if we
      // add per-host rate limiting.
      { concurrency: 2 },
    ),
  );

  workers.push(
    startWorker<"email-send">(
      "email-send",
      async (job) => {
        await sendBookByEmail(job.data);
        await job.updateProgress({ progress: 1, detail: `sent to ${job.data.recipient}` });
        return { sent: true };
      },
      // SMTP servers tend to throttle aggressively; one at a time is safe.
      { concurrency: 1 },
    ),
  );

  logger.info({ count: workers.length }, "workers started");
}

export async function stopWorkers(): Promise<void> {
  await Promise.all(workers.map((w) => w.close()));
  workers.length = 0;
}
