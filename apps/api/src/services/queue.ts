import { Queue, QueueEvents, Worker, type Job } from "bullmq";
import IORedis, { type RedisOptions } from "ioredis";
import { env } from "../env.ts";
import { logger } from "../logger.ts";

// BullMQ requires the Redis connection to have maxRetriesPerRequest: null and
// enableReadyCheck: false to support blocking commands (`BRPOPLPUSH`, etc).
const redisOpts: RedisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};
const redisFor = (purpose: string) => {
  const c = new IORedis(env.REDIS_URL, redisOpts);
  c.on("error", (err) => logger.warn({ err, purpose }, "redis error"));
  return c;
};

// One shared connection per role. Workers MUST use a dedicated connection
// because they hold blocking commands.
export const queueConnection = redisFor("queue");

/**
 * Job payload types. Add new queues here and they get strongly-typed enqueue
 * + Worker handlers below.
 */
export type JobMap = {
  "library-scan": { libraryId: string };
  "book-ingest": {
    bookId: string;
    bookType: "PDF" | "EPUB" | "CBX" | "MOBI" | "AZW3" | "FB2" | "AUDIOBOOK";
    absPath: string;
    fallbackTitle: string;
  };
  "metadata-refresh": { bookId: string };
  "email-send": {
    bookId: string;
    recipient: string;
    subject?: string;
    body?: string;
    /** Convert via `ebook-convert` before attaching (e.g. EPUB→MOBI for Kindle). */
    convertTo?: "mobi" | "azw3" | "epub" | "pdf";
  };
};

export type QueueName = keyof JobMap;

const queues = new Map<QueueName, Queue>();
const eventEmitters = new Map<QueueName, QueueEvents>();

export function getQueue<N extends QueueName>(name: N): Queue<JobMap[N]> {
  let q = queues.get(name);
  if (!q) {
    q = new Queue(name, { connection: queueConnection });
    queues.set(name, q);
  }
  return q as Queue<JobMap[N]>;
}

/** QueueEvents subscribes to global lifecycle messages for a queue. */
export function getQueueEvents(name: QueueName): QueueEvents {
  let e = eventEmitters.get(name);
  if (!e) {
    e = new QueueEvents(name, { connection: redisFor(`events:${name}`) });
    eventEmitters.set(name, e);
  }
  return e;
}

/**
 * Spawn a Worker for a queue. The processor receives a Job<T>. Concurrency
 * controls per-worker parallelism (BullMQ rate-limits with limiter for hard
 * caps; per-key concurrency uses group-by IDs in newer versions).
 */
export function startWorker<N extends QueueName>(
  name: N,
  processor: (job: Job<JobMap[N]>) => Promise<unknown>,
  opts: { concurrency?: number } = {},
): Worker<JobMap[N]> {
  const w = new Worker<JobMap[N]>(name, processor, {
    connection: redisFor(`worker:${name}`),
    concurrency: opts.concurrency ?? 1,
  });
  w.on("failed", (job, err) =>
    logger.warn({ err, jobId: job?.id, name }, "worker job failed"),
  );
  w.on("error", (err) => logger.warn({ err, name }, "worker error"));
  return w;
}
