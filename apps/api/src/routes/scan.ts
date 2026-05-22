import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { sValidator } from "@hono/standard-validator";
import { type } from "arktype";
import { authRequired } from "../middleware/auth.ts";
import { IdParam } from "../utils/schemas.ts";
import { enqueue, listTasks, getTask } from "../services/tasks.ts";
import { userCanAccessLibrary } from "../services/libraries.ts";
import { getQueue, type QueueName } from "../services/queue.ts";

const TaskFilterQuery = type({
  "status?": "'queued' | 'running' | 'completed' | 'failed'",
  "kind?": "'library-scan' | 'book-ingest' | 'metadata-refresh'",
});

const EXPOSED: QueueName[] = ["library-scan", "book-ingest", "metadata-refresh"];

async function findJob(jobId: string) {
  for (const name of EXPOSED) {
    const q = getQueue(name);
    const job = await q.getJob(jobId);
    if (job) return { queue: name, job };
  }
  return null;
}

export const scanRoutes = new Hono()
  .use("*", authRequired)
  .post("/libraries/:id/scan", sValidator("param", IdParam), async (c) => {
    const u = c.var.user!;
    if (!u.isAdmin && !u.permissions.includes("manipulateLibrary")) {
      throw new HTTPException(403, { message: "Library scan not permitted" });
    }
    const { id } = c.req.valid("param");
    const ok = await userCanAccessLibrary(u.id, u.isAdmin, id);
    if (!ok) throw new HTTPException(404, { message: "Library not found" });

    // jobId fixed to "scan-<libraryId>" so concurrent scan requests for the
    // same library coalesce — BullMQ refuses to enqueue a second job with the
    // same id while the first is in flight.
    const taskId = await enqueue(
      "library-scan",
      { libraryId: id },
      { jobId: `scan-${id}` },
    );
    return c.json({ taskId }, 202);
  })

  .get("/tasks", sValidator("query", TaskFilterQuery), async (c) => {
    const { status, kind } = c.req.valid("query");
    let tasks = await listTasks();
    if (status) tasks = tasks.filter((t) => t.status === status);
    if (kind) tasks = tasks.filter((t) => t.kind === kind);
    return c.json(tasks);
  })
  .get("/tasks/:id", async (c) => {
    const id = c.req.param("id");
    if (!id) throw new HTTPException(400, { message: "Bad id" });
    const task = await getTask(id);
    if (!task) throw new HTTPException(404, { message: "Task not found" });
    return c.json(task);
  })
  // Cancel a queued or running job. BullMQ's `Job.remove()` works for queued;
  // for active jobs it raises a flag the worker checks at progress callbacks.
  .delete("/tasks/:id", async (c) => {
    const u = c.var.user!;
    if (!u.isAdmin && !u.permissions.includes("manipulateLibrary")) {
      throw new HTTPException(403, { message: "Task cancel not permitted" });
    }
    const id = c.req.param("id");
    if (!id) throw new HTTPException(400, { message: "Bad id" });
    const found = await findJob(id);
    if (!found) throw new HTTPException(404, { message: "Task not found" });
    await found.job.remove();
    return c.json({ ok: true });
  })
  // Retry a failed job. Resets to "waiting" with the same payload.
  .post("/tasks/:id/retry", async (c) => {
    const u = c.var.user!;
    if (!u.isAdmin && !u.permissions.includes("manipulateLibrary")) {
      throw new HTTPException(403, { message: "Task retry not permitted" });
    }
    const id = c.req.param("id");
    if (!id) throw new HTTPException(400, { message: "Bad id" });
    const found = await findJob(id);
    if (!found) throw new HTTPException(404, { message: "Task not found" });
    await found.job.retry();
    return c.json({ ok: true });
  });
