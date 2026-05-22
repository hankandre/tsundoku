import { Hono, type Context } from "hono";
import { listBooks } from "../services/books.ts";
import { findByUsername, verifyPassword } from "../services/users.ts";
import { listLibrariesForUser } from "../services/libraries.ts";
import { listAuthors } from "../services/authors.ts";
import { listSeries, getSeriesBooks } from "../services/series.ts";
import { listShelves, getShelfBookIds } from "../services/shelves.ts";
import { getBatch } from "../services/book-ops.ts";
import { eq, and, sql } from "drizzle-orm";
import { schema } from "@tsundoku/db";
import { requireDb } from "../db.ts";

const OPDS_MIME_BY_BOOK_TYPE: Partial<Record<string, string>> = {
  PDF: "application/pdf",
  EPUB: "application/epub+zip",
  CBX: "application/x-cbz",
};

const OPDS_ROOT_SECTIONS = [
  {
    title: "Recent",
    id: "urn:tsundoku:catalog:recent",
    href: "/api/v1/opds/recent",
    kind: "acquisition" as const,
    content: "Newest additions",
  },
  {
    title: "Libraries",
    id: "urn:tsundoku:catalog:libraries",
    href: "/api/v1/opds/libraries",
  },
  {
    title: "Authors",
    id: "urn:tsundoku:catalog:authors",
    href: "/api/v1/opds/authors",
  },
  {
    title: "Shelves",
    id: "urn:tsundoku:catalog:shelves",
    href: "/api/v1/opds/shelves",
  },
  {
    title: "In progress",
    id: "urn:tsundoku:catalog:in-progress",
    href: "/api/v1/opds/in-progress",
    kind: "acquisition" as const,
    content: "Books you've started but not finished",
  },
  {
    title: "Series",
    id: "urn:tsundoku:catalog:series",
    href: "/api/v1/opds/series",
  },
];

/**
 * OPDS 1.x Atom catalog. Booklore's `OpdsController` serves these to external
 * readers (KOReader, Moon+, Marvin, KyBook). They use HTTP Basic Auth, which
 * we handle manually because Hono's JWT middleware doesn't apply.
 *
 * Surface:
 *   GET /opds                 navigation feed (root)
 *   GET /opds/recent          acquisition (newest 50)
 *   GET /opds/libraries       navigation: list libraries
 *   GET /opds/libraries/:id   acquisition: books in a library
 *   GET /opds/authors         navigation: list authors
 *   GET /opds/series          navigation: list series
 *   GET /opds/search?q=...    acquisition: full-text search
 */

async function basicAuth(authHeader: string | undefined) {
  if (!authHeader?.startsWith("Basic ")) return null;
  let decoded: string;
  try {
    decoded = atob(authHeader.slice(6).trim());
  } catch {
    return null;
  }
  const colon = decoded.indexOf(":");
  if (colon < 0) return null;
  const username = decoded.slice(0, colon);
  const password = decoded.slice(colon + 1);
  const user = await findByUsername(username);
  if (!user) return null;
  return (await verifyPassword(user, password)) ? user : null;
}

type AuthenticatedUser = NonNullable<Awaited<ReturnType<typeof basicAuth>>>;
type AuthResult = { ok: true; user: AuthenticatedUser } | { ok: false; response: Response };

async function authenticate(c: Context): Promise<AuthResult> {
  const user = await basicAuth(c.req.header("Authorization"));
  if (!user) return { ok: false, response: unauthorized() };
  return { ok: true, user };
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function feed(opts: {
  id: string;
  title: string;
  self: string;
  entries: string[];
  kind?: "navigation" | "acquisition";
}): string {
  const kind = opts.kind ?? "navigation";
  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:opds="http://opds-spec.org/2010/catalog" xmlns:dcterms="http://purl.org/dc/terms/">
  <id>${escapeXml(opts.id)}</id>
  <title>${escapeXml(opts.title)}</title>
  <updated>${new Date().toISOString()}</updated>
  <link rel="self" href="${escapeXml(opts.self)}" type="application/atom+xml;profile=opds-catalog;kind=${kind}"/>
  <link rel="start" href="/api/v1/opds" type="application/atom+xml;profile=opds-catalog;kind=navigation"/>
  <link rel="search" href="/api/v1/opds/search?q={searchTerms}" type="application/atom+xml" title="Search"/>
  ${opts.entries.join("\n  ")}
</feed>`;
}

function bookEntry(b: {
  id: string;
  fileName: string;
  bookType: string;
  addedOn: Date;
  title?: string | null;
  authors: string[];
}): string {
  const title = b.title ?? b.fileName;
  const author = b.authors.join(", ") || "Unknown";
  const mime = mimeForBookType(b.bookType);
  return `<entry>
    <title>${escapeXml(title)}</title>
    <id>urn:tsundoku:book:${b.id}</id>
    <updated>${new Date(b.addedOn).toISOString()}</updated>
    <author><name>${escapeXml(author)}</name></author>
    <link rel="http://opds-spec.org/image/thumbnail" href="/api/v1/books/${b.id}/cover" type="image/jpeg"/>
    <link rel="http://opds-spec.org/acquisition" href="/api/v1/files/${b.id}/stream" type="${mime}"/>
  </entry>`;
}

function mimeForBookType(bookType: string): string {
  return OPDS_MIME_BY_BOOK_TYPE[bookType] ?? "application/octet-stream";
}

function navigationEntry(opts: {
  title: string;
  id: string;
  href?: string;
  kind?: "navigation" | "acquisition";
  content?: string;
}): string {
  const link = opts.href
    ? `\n  <link rel="subsection" href="${escapeXml(opts.href)}" type="application/atom+xml;profile=opds-catalog;kind=${opts.kind ?? "navigation"}"/>`
    : "";
  const content = opts.content ? `\n  <content type="text">${escapeXml(opts.content)}</content>` : "";

  return `<entry>
  <title>${escapeXml(opts.title)}</title>
  <id>${escapeXml(opts.id)}</id>
  <updated>${new Date().toISOString()}</updated>${link}${content}
</entry>`;
}

function libraryEntry(library: { id: string; name: string }): string {
  return navigationEntry({
    title: library.name,
    id: `urn:tsundoku:library:${library.id}`,
    href: `/api/v1/opds/libraries/${library.id}`,
    kind: "acquisition",
  });
}

function authorEntry(author: { id: string; name: string; bookCount: number }): string {
  return navigationEntry({
    title: author.name,
    id: `urn:tsundoku:author:${author.id}`,
    content: `${author.bookCount} books`,
  });
}

function seriesEntry(series: { name: string; bookCount: number }): string {
  return navigationEntry({
    title: series.name,
    id: `urn:tsundoku:series:${encodeURIComponent(series.name)}`,
    href: `/api/v1/opds/series/${encodeURIComponent(series.name)}`,
    kind: "acquisition",
    content: `${series.bookCount} books`,
  });
}

function shelfEntry(shelf: { id: string; name: string; bookCount: number }): string {
  return navigationEntry({
    title: shelf.name,
    id: `urn:tsundoku:shelf:${shelf.id}`,
    href: `/api/v1/opds/shelves/${shelf.id}`,
    kind: "acquisition",
    content: `${shelf.bookCount} books`,
  });
}

function batchBookEntry(b: {
  id: string;
  fileName: string;
  bookType: string;
  title: string | null;
  authors?: string[];
}): string {
  return bookEntry({
    id: b.id,
    fileName: b.fileName,
    bookType: b.bookType,
    addedOn: new Date(),
    title: b.title,
    authors: b.authors ?? [],
  });
}

async function allowedSeriesLibraries(user: AuthenticatedUser): Promise<string[] | "all"> {
  if (user.permissions.admin) return "all";

  const db = requireDb();
  const rows = await db
    .select({ libraryId: schema.userLibraryMapping.libraryId })
    .from(schema.userLibraryMapping)
    .where(eq(schema.userLibraryMapping.userId, user.id));

  return rows.map((r) => r.libraryId);
}

const xmlResponse = (body: string, kind: "navigation" | "acquisition" = "navigation") =>
  new Response(body, {
    status: 200,
    headers: {
      "Content-Type": `application/atom+xml;profile=opds-catalog;kind=${kind}`,
    },
  });

const unauthorized = () =>
  new Response("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="tsundoku"' },
  });

export const opdsRoutes = new Hono()
  .get("/opds", async (c) => {
    const auth = await authenticate(c);
    if (!auth.ok) return auth.response;

    return xmlResponse(
      feed({
        id: "urn:tsundoku:catalog:root",
        title: "tsundoku",
        self: "/api/v1/opds",
        entries: OPDS_ROOT_SECTIONS.map(navigationEntry),
      }),
    );
  })
  .get("/opds/recent", async (c) => {
    const auth = await authenticate(c);
    if (!auth.ok) return auth.response;
    const user = auth.user;

    const books = await listBooks(user.id, user.permissions.admin, { size: 50 });
    return xmlResponse(
      feed({
        id: "urn:tsundoku:catalog:recent",
        title: "Recent books",
        self: "/api/v1/opds/recent",
        kind: "acquisition",
        entries: books.content.map(bookEntry),
      }),
      "acquisition",
    );
  })
  .get("/opds/libraries", async (c) => {
    const auth = await authenticate(c);
    if (!auth.ok) return auth.response;
    const user = auth.user;

    const libs = await listLibrariesForUser(user.id, user.permissions.admin);
    return xmlResponse(
      feed({
        id: "urn:tsundoku:catalog:libraries",
        title: "Libraries",
        self: "/api/v1/opds/libraries",
        entries: libs.map(libraryEntry),
      }),
    );
  })
  .get("/opds/libraries/:id", async (c) => {
    const auth = await authenticate(c);
    if (!auth.ok) return auth.response;
    const user = auth.user;

    const id = c.req.param("id");
    if (!id) return new Response("Bad id", { status: 400 });
    const books = await listBooks(user.id, user.permissions.admin, {
      libraryId: id,
      size: 100,
    });
    return xmlResponse(
      feed({
        id: `urn:tsundoku:library:${id}`,
        title: "Library",
        self: `/api/v1/opds/libraries/${id}`,
        kind: "acquisition",
        entries: books.content.map(bookEntry),
      }),
      "acquisition",
    );
  })
  .get("/opds/authors", async (c) => {
    const auth = await authenticate(c);
    if (!auth.ok) return auth.response;

    const authors = await listAuthors();
    return xmlResponse(
      feed({
        id: "urn:tsundoku:catalog:authors",
        title: "Authors",
        self: "/api/v1/opds/authors",
        entries: authors.map(authorEntry),
      }),
    );
  })
  .get("/opds/series", async (c) => {
    const auth = await authenticate(c);
    if (!auth.ok) return auth.response;

    const series = await listSeries();
    return xmlResponse(
      feed({
        id: "urn:tsundoku:catalog:series",
        title: "Series",
        self: "/api/v1/opds/series",
        entries: series.map(seriesEntry),
      }),
    );
  })
  .get("/opds/shelves", async (c) => {
    const auth = await authenticate(c);
    if (!auth.ok) return auth.response;
    const user = auth.user;

    const shelves = await listShelves(user.id);
    return xmlResponse(
      feed({
        id: "urn:tsundoku:catalog:shelves",
        title: "Shelves",
        self: "/api/v1/opds/shelves",
        entries: shelves.map(shelfEntry),
      }),
    );
  })
  .get("/opds/shelves/:id", async (c) => {
    const auth = await authenticate(c);
    if (!auth.ok) return auth.response;
    const user = auth.user;

    const id = c.req.param("id");
    if (!id) return new Response("Bad id", { status: 400 });
    const bookIds = await getShelfBookIds(user.id, id);
    const books = await getBatch(bookIds);
    return xmlResponse(
      feed({
        id: `urn:tsundoku:shelf:${id}`,
        title: "Shelf",
        self: `/api/v1/opds/shelves/${id}`,
        kind: "acquisition",
        entries: books.map(batchBookEntry),
      }),
      "acquisition",
    );
  })
  .get("/opds/in-progress", async (c) => {
    const auth = await authenticate(c);
    if (!auth.ok) return auth.response;
    const user = auth.user;

    const db = requireDb();
    const rows = await db
      .select({ bookId: schema.userBookProgress.bookId })
      .from(schema.userBookProgress)
      .where(
        and(
          eq(schema.userBookProgress.userId, user.id),
          sql`${schema.userBookProgress.finishedAt} is null`,
        ),
      );
    const books = await getBatch(rows.map((r) => r.bookId));
    return xmlResponse(
      feed({
        id: "urn:tsundoku:catalog:in-progress",
        title: "In progress",
        self: "/api/v1/opds/in-progress",
        kind: "acquisition",
        entries: books.map(batchBookEntry),
      }),
      "acquisition",
    );
  })
  .get("/opds/series/:name", async (c) => {
    const auth = await authenticate(c);
    if (!auth.ok) return auth.response;
    const user = auth.user;

    const raw = c.req.param("name");
    if (!raw) return new Response("Bad series", { status: 400 });
    const name = decodeURIComponent(raw);
    // OPDS shouldn't enforce per-library ACLs the same way the JSON API does;
    // we still scope to the user's allowed libraries.
    const allowedSet = await allowedSeriesLibraries(user);
    const books = await getSeriesBooks(name, allowedSet);
    return xmlResponse(
      feed({
        id: `urn:tsundoku:series:${encodeURIComponent(name)}`,
        title: name,
        self: `/api/v1/opds/series/${encodeURIComponent(name)}`,
        kind: "acquisition",
        entries: books.map(batchBookEntry),
      }),
      "acquisition",
    );
  })
  .get("/opds/search", async (c) => {
    const auth = await authenticate(c);
    if (!auth.ok) return auth.response;
    const user = auth.user;

    const q = c.req.query("q") ?? "";
    const books = await searchBooksForOpds(user, q);
    return xmlResponse(
      feed({
        id: `urn:tsundoku:catalog:search:${encodeURIComponent(q)}`,
        title: `Search: ${q}`,
        self: `/api/v1/opds/search?q=${encodeURIComponent(q)}`,
        kind: "acquisition",
        entries: books.content.map(bookEntry),
      }),
      "acquisition",
    );
  });

async function searchBooksForOpds(user: AuthenticatedUser, q: string) {
  if (!q) return { content: [] as Awaited<ReturnType<typeof listBooks>>["content"] };
  return listBooks(user.id, user.permissions.admin, { search: q, size: 100 });
}
