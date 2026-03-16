import { db, schema } from "../db/client";
import { eq, and, sql, desc, between } from "drizzle-orm";

const ensureDb = () => {
  if (!db) {
    throw new Error("Database not configured");
  }
  return db;
};

export interface ReadingSessionHeatmapResponse {
  date: string;
  count: number;
}

export const getSessionHeatmapForYear = async (userId: string, year: number): Promise<ReadingSessionHeatmapResponse[]> => {
  const database = ensureDb();

  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31, 23, 59, 59);

  const result = await database
    .select({
      date: sql<string>`DATE(${schema.readingSessions.startTime})`,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.readingSessions)
    .where(
      and(
        eq(schema.readingSessions.userId, userId),
        between(schema.readingSessions.startTime, startDate, endDate)
      )
    )
    .groupBy(sql`DATE(${schema.readingSessions.startTime})`)
    .orderBy(sql`DATE(${schema.readingSessions.startTime})`);

  return result.map((r) => ({
    date: r.date,
    count: Number(r.count),
  }));
};

export const getReadingDates = async (userId: string): Promise<ReadingSessionHeatmapResponse[]> => {
  const database = ensureDb();

  const result = await database
    .select({
      date: sql<string>`DATE(${schema.readingSessions.startTime})`,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.readingSessions)
    .where(eq(schema.readingSessions.userId, userId))
    .groupBy(sql`DATE(${schema.readingSessions.startTime})`)
    .orderBy(sql`DATE(${schema.readingSessions.startTime})`);

  return result.map((r) => ({
    date: r.date,
    count: Number(r.count),
  }));
};

export interface PeakHoursResponse {
  hour: number;
  count: number;
}

export const getPeakReadingHours = async (userId: string, year?: number, month?: number): Promise<PeakHoursResponse[]> => {
  const database = ensureDb();

  let whereClause = eq(schema.readingSessions.userId, userId);

  const result = await database
    .select({
      hour: sql<number>`EXTRACT(HOUR FROM ${schema.readingSessions.startTime})::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.readingSessions)
    .where(whereClause)
    .groupBy(sql`EXTRACT(HOUR FROM ${schema.readingSessions.startTime})`)
    .orderBy(desc(sql`count(*)`));

  return result.map((r) => ({
    hour: Number(r.hour),
    count: Number(r.count),
  }));
};

export interface ReadingStreakResponse {
  currentStreak: number;
  longestStreak: number;
  totalReadingDays: number;
  weeklyActivity: Array<{ week: string; days: number }>;
}

export const getReadingStreak = async (userId: string): Promise<ReadingStreakResponse> => {
  const database = ensureDb();

  const readingDays = await database
    .select({
      date: sql<string>`DATE(${schema.readingSessions.startTime})`.as("date"),
    })
    .from(schema.readingSessions)
    .where(eq(schema.readingSessions.userId, userId))
    .groupBy(sql`DATE(${schema.readingSessions.startTime})`)
    .orderBy(desc(sql`DATE(${schema.readingSessions.startTime})`));

  const dates = readingDays.map((r) => r.date);
  const totalReadingDays = dates.length;

  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < dates.length; i++) {
    const current = new Date(dates[i]);
    current.setHours(0, 0, 0, 0);

    if (i === 0) {
      const diff = Math.floor((today.getTime() - current.getTime()) / (1000 * 60 * 60 * 24));
      if (diff <= 1) {
        tempStreak = 1;
      }
    } else {
      const prev = new Date(dates[i - 1]);
      prev.setHours(0, 0, 0, 0);
      const diff = Math.floor((prev.getTime() - current.getTime()) / (1000 * 60 * 60 * 24));
      if (diff === 1) {
        tempStreak++;
      } else {
        if (i === 1 || (i > 1 && tempStreak > 0)) {
          if (tempStreak > longestStreak) longestStreak = tempStreak;
        }
        tempStreak = 1;
      }
    }
  }

  if (tempStreak > longestStreak) longestStreak = tempStreak;
  if (dates.length > 0) {
    const lastDate = new Date(dates[0]);
    lastDate.setHours(0, 0, 0, 0);
    const diff = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diff <= 1) {
      currentStreak = tempStreak;
    }
  }

  return {
    currentStreak,
    longestStreak,
    totalReadingDays,
    weeklyActivity: [],
  };
};

export interface GenreStatisticsResponse {
  genre: string;
  bookCount: number;
  percentage: number;
}

export const getGenreStatistics = async (_userId: string): Promise<GenreStatisticsResponse[]> => {
  return [];
};

export interface BookDistributionsResponse {
  byRating: Array<{ rating: number | null; count: number }>;
  byProgress: Array<{ range: string; count: number }>;
  byReadStatus: Array<{ status: string; count: number }>;
}

export const getBookDistributions = async (_userId: string): Promise<BookDistributionsResponse> => {
  return {
    byRating: [],
    byProgress: [],
    byReadStatus: [],
  };
};

export interface CompletionTimelineResponse {
  month: string;
  completed: number;
  started: number;
}

export const getCompletionTimeline = async (_userId: string, _year: number): Promise<CompletionTimelineResponse[]> => {
  return [];
};

export interface SessionScatterResponse {
  date: string;
  duration: number;
  progress: number;
}

export const getSessionScatter = async (_userId: string, _year: number): Promise<SessionScatterResponse[]> => {
  return [];
};

export interface BookTimelineResponse {
  bookId: string;
  title: string;
  startDate: string;
  endDate: string | null;
}

export const getBookTimeline = async (_userId: string, _year: number): Promise<BookTimelineResponse[]> => {
  return [];
};

export interface BookCompletionHeatmapResponse {
  year: number;
  month: number;
  count: number;
}

export const getBookCompletionHeatmap = async (_userId: string): Promise<BookCompletionHeatmapResponse[]> => {
  return [];
};

export interface PageTurnerScoreResponse {
  bookId: string;
  title: string;
  score: number;
}

export const getPageTurnerScores = async (_userId: string): Promise<PageTurnerScoreResponse[]> => {
  return [];
};

export interface CompletionRaceResponse {
  bookId: string;
  title: string;
  progress: number;
}

export const getCompletionRace = async (_userId: string, _year: number): Promise<CompletionRaceResponse[]> => {
  return [];
};

export interface FavoriteReadingDaysResponse {
  day: string;
  count: number;
}

export const getFavoriteReadingDays = async (_userId: string): Promise<FavoriteReadingDaysResponse[]> => {
  return [];
};

export interface ReadingSpeedResponse {
  date: string;
  speed: number;
}

export const getReadingSpeedForYear = async (_userId: string, _year: number): Promise<ReadingSpeedResponse[]> => {
  return [];
};

export interface ReadingSessionTimelineResponse {
  bookId: string;
  title: string;
  sessions: Array<{ date: string; startTime: string; endTime: string; duration: number }>;
}

export const getSessionTimelineForWeek = async (_userId: string, _year: number, _week: number): Promise<ReadingSessionTimelineResponse[]> => {
  return [];
};

export interface ListeningHeatmapResponse {
  date: string;
  count: number;
  duration: number;
}

export const getListeningHeatmapForMonth = async (_userId: string, _year: number, _month: number): Promise<ListeningHeatmapResponse[]> => {
  return [];
};

export interface WeeklyListeningTrendResponse {
  week: string;
  hours: number;
}

export const getWeeklyListeningTrend = async (_userId: string, _weeks: number): Promise<WeeklyListeningTrendResponse[]> => {
  return [];
};

export interface ListeningCompletionResponse {
  inProgress: Array<{ bookId: string; title: string; progress: number }>;
  completed: number;
  totalHours: number;
}

export const getListeningCompletion = async (_userId: string): Promise<ListeningCompletionResponse> => {
  return {
    inProgress: [],
    completed: 0,
    totalHours: 0,
  };
};

export interface MonthlyPaceResponse {
  month: string;
  completed: number;
  hours: number;
}

export const getMonthlyListeningPace = async (_userId: string, _months: number): Promise<MonthlyPaceResponse[]> => {
  return [];
};

export interface ListeningFinishFunnelResponse {
  started: number;
  quarterWay: number;
  halfway: number;
  threeQuarterWay: number;
  finished: number;
}

export const getListeningFinishFunnel = async (_userId: string): Promise<ListeningFinishFunnelResponse> => {
  return {
    started: 0,
    quarterWay: 0,
    halfway: 0,
    threeQuarterWay: 0,
    finished: 0,
  };
};

export interface ListeningAuthorResponse {
  author: string;
  booksCompleted: number;
  hours: number;
}

export const getListeningAuthorStats = async (_userId: string): Promise<ListeningAuthorResponse[]> => {
  return [];
};

export interface LongestAudiobookResponse {
  bookId: string;
  title: string;
  duration: number;
}

export const getListeningLongestBooks = async (_userId: string): Promise<LongestAudiobookResponse[]> => {
  return [];
};

export const getListeningSessionScatter = async (_userId: string): Promise<SessionScatterResponse[]> => {
  return [];
};

export const getListeningGenreStatistics = async (_userId: string): Promise<GenreStatisticsResponse[]> => {
  return [];
};

export const getListeningPeakHours = async (userId: string, year?: number, month?: number): Promise<PeakHoursResponse[]> => {
  return getPeakReadingHours(userId, year, month);
};
