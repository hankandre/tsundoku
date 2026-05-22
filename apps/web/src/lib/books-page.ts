import type { Density } from "$lib/components/library/density-toggle.svelte";

export type BooksPageBook = {
  id: string;
  title?: string | null;
  fileName: string;
  authors: string[];
  bookType: string;
  pageCount?: number | null;
  libraryId?: string;
};

export type SidebarLibrary = {
  id: number | string;
  name: string;
};

export type BooksPageFilter = {
  search: string;
  bookType: string;
  libraryId: string;
  sort: string;
  direction: string;
};

export type LibraryBookGroup = {
  id: number | string;
  name: string;
  books: BooksPageBook[];
};

export type BookGroupResult = {
  groups: LibraryBookGroup[];
  orphans: BooksPageBook[];
};

export const FORMAT_LABELS: Record<string, string> = {
  "": "All",
  PDF: "PDF",
  EPUB: "EPUB",
  CBX: "CBZ",
  MOBI: "MOBI",
  AZW3: "AZW3",
  FB2: "FB2",
  AUDIOBOOK: "Audiobook",
};

export const SORT_LABELS: Record<string, string> = {
  addedOn: "Added",
  title: "Title",
  rating: "Rating",
  pageCount: "Pages",
};

export function isDensity(value: string | null): value is Density {
  return value === "grid" || value === "list";
}

export function buildBookPageParams(input: {
  page: number;
  size: number;
  filter: BooksPageFilter;
}): URLSearchParams {
  const params = new URLSearchParams({
    page: String(input.page),
    size: String(input.size),
  });

  for (const [key, value] of Object.entries(input.filter)) {
    if (value) params.set(key, value);
  }
  return params;
}

export function appendUniqueBooks(
  current: BooksPageBook[],
  incoming: BooksPageBook[],
): BooksPageBook[] {
  const seen = new Set(current.map((book) => book.id));
  const next = [...current];
  for (const book of incoming) {
    if (!seen.has(book.id)) next.push(book);
  }
  return next;
}

export function groupBooksByLibrary(
  books: BooksPageBook[],
  libraries: SidebarLibrary[],
  activeLibraryId: string,
): BookGroupResult | null {
  if (activeLibraryId) return null;

  const byId = new Map<string, LibraryBookGroup>();
  for (const library of libraries) {
    byId.set(String(library.id), { id: library.id, name: library.name, books: [] });
  }

  const orphans: BooksPageBook[] = [];
  for (const book of books) {
    const key = book.libraryId ? String(book.libraryId) : "";
    const group = byId.get(key);
    if (group) group.books.push(book);
    else orphans.push(book);
  }

  return {
    groups: Array.from(byId.values()).filter((group) => group.books.length > 0),
    orphans,
  };
}

export function activeBookFilters(
  filter: BooksPageFilter,
  libraries: SidebarLibrary[],
): { key: string; label: string }[] {
  const active: { key: string; label: string }[] = [];

  if (filter.search) active.push({ key: "search", label: `"${filter.search}"` });
  if (filter.bookType) active.push({ key: "bookType", label: filter.bookType });
  if (filter.libraryId) {
    const library = libraries.find((item) => String(item.id) === filter.libraryId);
    active.push({ key: "libraryId", label: library?.name ?? "Library" });
  }

  return active;
}
