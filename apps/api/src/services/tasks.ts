import { getQueue, getQueueEvents, type QueueName } from "./queue.ts";
import { logger } from "../logger.ts";

/**
 * Tasks API expressed in terms of BullMQ. The Queue + Worker layer in
 * `queue.ts` is the engine; this file is the read/list/subscribe facade the
 * routes and WS layer consume.
 */

export type TaskStatus = "queued" | "running" | "completed" | "failed";

export type TaskRecord = {
  id: string;
  kind: string;
  status: TaskStatus;
  startedAt: Date;
  finishedAt?: Date;
  progress?: number;
  detail?: string;
  error?: string;
};

// Active queues we expose via /api/v1/tasks. Add new queue names here as they
// come online.
const EXPOSED: QueueName[] = [
  "library-scan",
  "book-ingest",
  "metadata-refresh",
  "email-send",
];

function bullStatusToTask(state: string): TaskStatus {
  switch (state) {
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "active":
      return "running";
    default:
      return "queued";
  }
}

function progressFromBull(p: unknown): { progress?: number; detail?: string } {
  if (typeof p === "number") return { progress: p };
  if (p && typeof p === "object") {
    const o = p as { progress?: number; detail?: string };
    return { progress: o.progress, detail: o.detail };
  }
  return {};
}

async function readJob(queueName: QueueName, jobId: string): Promise<TaskRecord | null> {
  const q = getQueue(queueName);
  const job = await q.getJob(jobId);
  if (!job) return null;
  const state = await job.getState();
  const prog = progressFromBull(job.progress);
  return {
    id: job.id!,
    kind: queueName,
    status: bullStatusToTask(state),
    startedAt: new Date(job.timestamp),
    finishedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
    progress: prog.progress,
    detail: prog.detail,
    error: job.failedReason,
  };
}

export async function getTask(jobId: string): Promise<TaskRecord | null> {
  for (const name of EXPOSED) {
    const t = await readJob(name, jobId);
    if (t) return t;
  }
  return null;
}

export async function listTasks(): Promise<TaskRecord[]> {
  const results: TaskRecord[] = [];
  for (const name of EXPOSED) {
    const q = getQueue(name);
    // Most-recent first; cap at 50 per queue. Tweak as needed.
    const jobs = await q.getJobs(["active", "waiting", "delayed", "completed", "failed"], 0, 49);
    for (const job of jobs) {
      const state = await job.getState();
      const prog = progressFromBull(job.progress);
      results.push({
        id: job.id!,
        kind: name,
        status: bullStatusToTask(state),
        startedAt: new Date(job.timestamp),
        finishedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
        progress: prog.progress,
        detail: prog.detail,
        error: job.failedReason,
      });
    }
  }
  return results.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
}

/**
 * Wire global QueueEvents → user-supplied listener. The listener receives a
 * synthetic TaskRecord on each lifecycle change (active/progress/completed/
 * failed). Used by the WS push layer to broadcast `/queue/task-progress`.
 */
export function onTaskUpdate(cb: (t: TaskRecord) => void): () => void {
  const unsubscribers: Array<() => void> = [];
  for (const name of EXPOSED) {
    const ev = getQueueEvents(name);
    const fwd = (event: string) => async ({
      jobId,
      data,
    }: {
      jobId: string;
      data?: unknown;
    }) => {
      try {
        const t = await readJob(name, jobId);
        if (!t) return;
        // For progress events, the data payload IS the progress value.
        if (event === "progress" && data != null) {
          const p = progressFromBull(data);
          if (p.progress != null) t.progress = p.progress;
          if (p.detail) t.detail = p.detail;
        }
        cb(t);
      } catch (e) {
        logger.warn({ err: e, jobId, name }, "task event listener");
      }
    };
    const active = fwd("active");
    const progress = fwd("progress");
    const completed = fwd("completed");
    const failed = fwd("failed");
    ev.on("active", active);
    ev.on("progress", progress);
    ev.on("completed", completed);
    ev.on("failed", failed);
    unsubscribers.push(() => {
      ev.off("active", active);
      ev.off("progress", progress);
      ev.off("completed", completed);
      ev.off("failed", failed);
    });
  }
  return () => {
    for (const u of unsubscribers) u();
  };
}

/**
 * Enqueue a job and return the BullMQ job ID. The previous `runTask(...)`
 * signature returned `{ id, result }` for in-process awaiting; with BullMQ
 * the caller treats the queue as fire-and-forget and observes progress via
 * the events stream.
 */
export async function enqueue<N extends QueueName>(
  name: N,
  payload: import("./queue.ts").JobMap[N],
  opts: { jobId?: string; deduplicationKey?: string } = {},
): Promise<string> {
  // BullMQ Queue.add typing is awkward when the data is parameterized through
  // a generic; cast to the loosely-typed call signature to side-step it.
  const q = getQueue(name) as unknown as {
    add: (
      n: string,
      d: unknown,
      o: Record<string, unknown>,
    ) => Promise<{ id: string }>;
  };
  const job = await q.add(name, payload, {
    jobId: opts.jobId,
    // BullMQ deduplicates by jobId when one is supplied; alternative dedup via
    // group keys exists in newer versions but jobId is sufficient for "one
    // scan per library at a time."
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 100 },
  });
  return job.id;
}
