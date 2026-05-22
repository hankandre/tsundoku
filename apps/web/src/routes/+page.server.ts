import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";

type LibSummary = {
  totalBooks: number;
  byLibrary: { libraryId: string; libraryName: string; count: number }[];
  byFormat: { bookType: string; count: number }[];
};
type ReadingStats = {
  sessionCount: number;
  minutesRead: number;
  booksFinished: number;
};
type Health = { status: string; version: string; timestamp: string };
type BookRow = {
  id: string;
  title?: string | null;
  fileName: string;
  authors: string[];
  bookType: string;
  pageCount?: number | null;
  addedOn: string;
};
type BookPage = { content: BookRow[]; totalElements: number };

export const load: PageServerLoad = async ({ locals, cookies, fetch }) => {
  // The dashboard is only meaningful when signed in — show the login screen,
  // not a hollow shell, to anyone without a session.
  if (!locals.user) {
    throw redirect(303, "/login");
  }

  let health: Health | null = null;
  let summary: LibSummary | null = null;
  let reading: ReadingStats | null = null;
  let recent: BookRow[] = [];
  let error: string | null = null;

  const { rpc } = locals;

  try {
    const res = await rpc.api.v1.health.$get();
    if (res.ok) health = (await res.json()) as Health;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  {
    const [libRes, readRes, booksRes] = await Promise.allSettled([
      rpc.api.v1.stats.libraries.$get(),
      rpc.api.v1.stats.reading.$get(),
      rpc.api.v1.books.$get({ query: { sort: "addedOn", direction: "desc", size: "12" } }),
    ]);

    if (libRes.status === "fulfilled" && libRes.value.ok) {
      summary = (await libRes.value.json()) as LibSummary;
    } else if (libRes.status === "fulfilled") {
      error = `Stats failed: ${libRes.value.status}`;
    }
    if (readRes.status === "fulfilled" && readRes.value.ok) {
      reading = (await readRes.value.json()) as ReadingStats;
    }
    if (booksRes.status === "fulfilled" && booksRes.value.ok) {
      const page = (await booksRes.value.json()) as BookPage;
      recent = page.content;
    }
  }

  return { health, summary, reading, recent, error };
};
