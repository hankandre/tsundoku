import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { sValidator } from "@hono/standard-validator";
import { type } from "arktype";
import { authRequired } from "../middleware/auth.ts";
import { IdParam } from "../utils/schemas.ts";
import { audiobookSummary } from "../services/audiobook.ts";
import { getProgress, setProgress } from "../services/progress.ts";

const CurrentBody = type({
  positionSeconds: "number >= 0",
});

export const audiobookRoutes = new Hono()
  .use("*", authRequired)
  .get("/audiobook/:id/tracks", sValidator("param", IdParam), async (c) => {
    const { id } = c.req.valid("param");
    const summary = await audiobookSummary(id);
    if (!summary) throw new HTTPException(404, { message: "Not an audiobook or unreadable" });
    return c.json({
      durationSeconds: summary.durationSeconds,
      trackCount: summary.trackCount,
    });
  })
  .get("/audiobook/:id/chapters", sValidator("param", IdParam), async (c) => {
    const { id } = c.req.valid("param");
    const summary = await audiobookSummary(id);
    if (!summary) throw new HTTPException(404, { message: "Not an audiobook or unreadable" });
    return c.json(summary.chapters);
  })
  .get("/audiobook/:id/current", sValidator("param", IdParam), async (c) => {
    const u = c.var.user!;
    const { id } = c.req.valid("param");
    const prog = await getProgress(u.id, id);
    return c.json({ positionSeconds: prog?.audiobookProgressSeconds ?? 0 });
  })
  .put(
    "/audiobook/:id/current",
    sValidator("param", IdParam),
    sValidator("json", CurrentBody),
    async (c) => {
      const u = c.var.user!;
      const { id } = c.req.valid("param");
      const { positionSeconds } = c.req.valid("json");
      await setProgress({
        userId: u.id,
        bookId: id,
        audiobookProgressSeconds: Math.floor(positionSeconds),
      });
      return c.json({ ok: true });
    },
  );
