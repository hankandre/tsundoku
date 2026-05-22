import { Hono } from "hono";
import { sValidator } from "@hono/standard-validator";
import { type } from "arktype";
import { authRequired } from "../middleware/auth.ts";
import {
  librarySummary,
  readingStats,
  readingTimeHistogram,
  booksFinishedHistogram,
  hourOfDayHistogram,
  dayOfWeekHistogram,
  topAuthors,
  topSeries,
  readingStreaks,
} from "../services/stats.ts";

// Shared validators for the histogram endpoints. `bucket` matches Postgres
// `date_trunc` units; `buckets` caps the row count returned.
const Buckets = type("string.integer.parse").to("1 <= number <= 365");
const Limit = type("string.integer.parse").to("1 <= number <= 50");

const BucketQuery = type({
  "bucket?": "'day' | 'week' | 'month'",
  "buckets?": Buckets,
});

const LimitQuery = type({
  "limit?": Limit,
});

export const statsRoutes = new Hono()
  .use("*", authRequired)
  .get("/stats/libraries", async (c) => {
    const u = c.var.user!;
    return c.json(await librarySummary(u.id, u.isAdmin));
  })
  .get("/stats/reading", async (c) => {
    const u = c.var.user!;
    return c.json(await readingStats(u.id));
  })
  .get("/stats/reading-time", sValidator("query", BucketQuery), async (c) => {
    const u = c.var.user!;
    const { bucket, buckets } = c.req.valid("query");
    return c.json(await readingTimeHistogram(u.id, bucket ?? "day", buckets));
  })
  .get("/stats/books-finished", sValidator("query", BucketQuery), async (c) => {
    const u = c.var.user!;
    const { bucket, buckets } = c.req.valid("query");
    return c.json(await booksFinishedHistogram(u.id, bucket ?? "day", buckets));
  })
  .get("/stats/hour-of-day", async (c) => {
    const u = c.var.user!;
    return c.json(await hourOfDayHistogram(u.id));
  })
  .get("/stats/day-of-week", async (c) => {
    const u = c.var.user!;
    return c.json(await dayOfWeekHistogram(u.id));
  })
  .get("/stats/top-authors", sValidator("query", LimitQuery), async (c) => {
    const u = c.var.user!;
    const { limit } = c.req.valid("query");
    return c.json(await topAuthors(u.id, limit));
  })
  .get("/stats/top-series", sValidator("query", LimitQuery), async (c) => {
    const u = c.var.user!;
    const { limit } = c.req.valid("query");
    return c.json(await topSeries(u.id, limit));
  })
  .get("/stats/streaks", async (c) => {
    const u = c.var.user!;
    return c.json(await readingStreaks(u.id));
  });
