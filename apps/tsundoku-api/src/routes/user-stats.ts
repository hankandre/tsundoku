import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppVariables } from "../types/app-variables";
import { fail } from "../http/errors";
import {
  getSessionHeatmapForYear,
  getReadingDates,
  getPeakReadingHours,
  getReadingStreak,
  getGenreStatistics,
  getBookDistributions,
  getCompletionTimeline,
  getSessionScatter,
  getBookTimeline,
  getBookCompletionHeatmap,
  getPageTurnerScores,
  getCompletionRace,
  getFavoriteReadingDays,
  getReadingSpeedForYear,
  getSessionTimelineForWeek,
  getListeningHeatmapForMonth,
  getWeeklyListeningTrend,
  getListeningCompletion,
  getMonthlyListeningPace,
  getListeningFinishFunnel,
  getListeningAuthorStats,
  getListeningLongestBooks,
  getListeningSessionScatter,
  getListeningGenreStatistics,
  getListeningPeakHours,
} from "../services/user-stats-service";

const getAuthUser = (c: import("hono").Context) => {
  const authUser = c.get("authUser");
  if (!authUser) {
    fail(401, "Unauthorized");
  }
  return authUser;
};

const checkUserStatsPermission = (authUser: ReturnType<typeof getAuthUser>) => {
  if (!authUser.isAdmin && !authUser.canAccessUserStats) {
    fail(403, "Forbidden");
  }
};

const yearParamSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
});

const yearMonthParamSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

const yearWeekParamSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  week: z.coerce.number().int().min(1).max(53),
});

const optionalYearMonthSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
});

const weeksParamSchema = z.object({
  weeks: z.coerce.number().int().min(1).max(52).default(26),
});

const monthsParamSchema = z.object({
  months: z.coerce.number().int().min(1).max(24).default(12),
});

export const userStatsRoutes = new Hono<{ Variables: AppVariables }>();

userStatsRoutes.get("/reading/heatmap", zValidator("query", yearParamSchema, handleValidationError), async (c) => {
  const authUser = getAuthUser(c);
  checkUserStatsPermission(authUser);
  const { year } = c.req.valid("query");
  const data = await getSessionHeatmapForYear(authUser.userId, year);
  return c.json(data);
});

userStatsRoutes.get("/reading/heatmap/monthly", zValidator("query", yearMonthParamSchema, handleValidationError), async (c) => {
  const authUser = getAuthUser(c);
  checkUserStatsPermission(authUser);
  const { year, month } = c.req.valid("query");
  const data = await getSessionHeatmapForYear(authUser.userId, year);
  const monthData = data.filter((d) => {
    const date = new Date(d.date);
    return date.getMonth() + 1 === month;
  });
  return c.json(monthData);
});

userStatsRoutes.get("/reading/timeline", zValidator("query", yearWeekParamSchema, handleValidationError), async (c) => {
  const authUser = getAuthUser(c);
  checkUserStatsPermission(authUser);
  const { year, week } = c.req.valid("query");
  const data = await getSessionTimelineForWeek(authUser.userId, year, week);
  return c.json(data);
});

userStatsRoutes.get("/reading/speed", zValidator("query", yearParamSchema, handleValidationError), async (c) => {
  const authUser = getAuthUser(c);
  checkUserStatsPermission(authUser);
  const { year } = c.req.valid("query");
  const data = await getReadingSpeedForYear(authUser.userId, year);
  return c.json(data);
});

userStatsRoutes.get("/reading/peak-hours", zValidator("query", optionalYearMonthSchema, handleValidationError), async (c) => {
  const authUser = getAuthUser(c);
  checkUserStatsPermission(authUser);
  const { year, month } = c.req.valid("query");
  const data = await getPeakReadingHours(authUser.userId, year, month);
  return c.json(data);
});

userStatsRoutes.get("/reading/favorite-days", async (c) => {
  const authUser = getAuthUser(c);
  checkUserStatsPermission(authUser);
  const data = await getFavoriteReadingDays(authUser.userId);
  return c.json(data);
});

userStatsRoutes.get("/reading/genres", async (c) => {
  const authUser = getAuthUser(c);
  checkUserStatsPermission(authUser);
  const data = await getGenreStatistics(authUser.userId);
  return c.json(data);
});

userStatsRoutes.get("/reading/completion-timeline", zValidator("query", yearParamSchema, handleValidationError), async (c) => {
  const authUser = getAuthUser(c);
  checkUserStatsPermission(authUser);
  const { year } = c.req.valid("query");
  const data = await getCompletionTimeline(authUser.userId, year);
  return c.json(data);
});

userStatsRoutes.get("/reading/book-completion-heatmap", async (c) => {
  const authUser = getAuthUser(c);
  checkUserStatsPermission(authUser);
  const data = await getBookCompletionHeatmap(authUser.userId);
  return c.json(data);
});

userStatsRoutes.get("/reading/page-turner-scores", async (c) => {
  const authUser = getAuthUser(c);
  checkUserStatsPermission(authUser);
  const data = await getPageTurnerScores(authUser.userId);
  return c.json(data);
});

userStatsRoutes.get("/reading/completion-race", zValidator("query", yearParamSchema, handleValidationError), async (c) => {
  const authUser = getAuthUser(c);
  checkUserStatsPermission(authUser);
  const { year } = c.req.valid("query");
  const data = await getCompletionRace(authUser.userId, year);
  return c.json(data);
});

userStatsRoutes.get("/reading/book-distributions", async (c) => {
  const authUser = getAuthUser(c);
  checkUserStatsPermission(authUser);
  const data = await getBookDistributions(authUser.userId);
  return c.json(data);
});

userStatsRoutes.get("/reading/dates", async (c) => {
  const authUser = getAuthUser(c);
  checkUserStatsPermission(authUser);
  const data = await getReadingDates(authUser.userId);
  return c.json(data);
});

userStatsRoutes.get("/reading/session-scatter", zValidator("query", yearParamSchema, handleValidationError), async (c) => {
  const authUser = getAuthUser(c);
  checkUserStatsPermission(authUser);
  const { year } = c.req.valid("query");
  const data = await getSessionScatter(authUser.userId, year);
  return c.json(data);
});

userStatsRoutes.get("/reading/streak", async (c) => {
  const authUser = getAuthUser(c);
  checkUserStatsPermission(authUser);
  const data = await getReadingStreak(authUser.userId);
  return c.json(data);
});

userStatsRoutes.get("/reading/book-timeline", zValidator("query", yearParamSchema, handleValidationError), async (c) => {
  const authUser = getAuthUser(c);
  checkUserStatsPermission(authUser);
  const { year } = c.req.valid("query");
  const data = await getBookTimeline(authUser.userId, year);
  return c.json(data);
});

userStatsRoutes.get("/listening/heatmap/monthly", zValidator("query", yearMonthParamSchema, handleValidationError), async (c) => {
  const authUser = getAuthUser(c);
  checkUserStatsPermission(authUser);
  const { year, month } = c.req.valid("query");
  const data = await getListeningHeatmapForMonth(authUser.userId, year, month);
  return c.json(data);
});

userStatsRoutes.get("/listening/weekly-trend", zValidator("query", weeksParamSchema, handleValidationError), async (c) => {
  const authUser = getAuthUser(c);
  checkUserStatsPermission(authUser);
  const { weeks } = c.req.valid("query");
  const data = await getWeeklyListeningTrend(authUser.userId, weeks);
  return c.json(data);
});

userStatsRoutes.get("/listening/completion", async (c) => {
  const authUser = getAuthUser(c);
  checkUserStatsPermission(authUser);
  const data = await getListeningCompletion(authUser.userId);
  return c.json(data);
});

userStatsRoutes.get("/listening/monthly-pace", zValidator("query", monthsParamSchema, handleValidationError), async (c) => {
  const authUser = getAuthUser(c);
  checkUserStatsPermission(authUser);
  const { months } = c.req.valid("query");
  const data = await getMonthlyListeningPace(authUser.userId, months);
  return c.json(data);
});

userStatsRoutes.get("/listening/finish-funnel", async (c) => {
  const authUser = getAuthUser(c);
  checkUserStatsPermission(authUser);
  const data = await getListeningFinishFunnel(authUser.userId);
  return c.json(data);
});

userStatsRoutes.get("/listening/peak-hours", zValidator("query", optionalYearMonthSchema, handleValidationError), async (c) => {
  const authUser = getAuthUser(c);
  checkUserStatsPermission(authUser);
  const { year, month } = c.req.valid("query");
  const data = await getListeningPeakHours(authUser.userId, year, month);
  return c.json(data);
});

userStatsRoutes.get("/listening/genres", async (c) => {
  const authUser = getAuthUser(c);
  checkUserStatsPermission(authUser);
  const data = await getListeningGenreStatistics(authUser.userId);
  return c.json(data);
});

userStatsRoutes.get("/listening/authors", async (c) => {
  const authUser = getAuthUser(c);
  checkUserStatsPermission(authUser);
  const data = await getListeningAuthorStats(authUser.userId);
  return c.json(data);
});

userStatsRoutes.get("/listening/session-scatter", async (c) => {
  const authUser = getAuthUser(c);
  checkUserStatsPermission(authUser);
  const data = await getListeningSessionScatter(authUser.userId);
  return c.json(data);
});

userStatsRoutes.get("/listening/longest-books", async (c) => {
  const authUser = getAuthUser(c);
  checkUserStatsPermission(authUser);
  const data = await getListeningLongestBooks(authUser.userId);
  return c.json(data);
});

function handleValidationError(err: unknown) {
  if (err && typeof err === "object" && "issues" in err) {
    const issues = (err as { issues: Array<{ path: string; message: string }> }).issues;
    const messages = issues.map((i) => `${i.path}: ${i.message}`);
    fail(400, messages.join(", "));
  }
  fail(400, "Validation failed");
}
