import { Hono } from "hono";
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
  const mime =
    b.bookType === "PDF"
      ? "application/pdf"
      : b.bookType === "EPUB"
        ? "application/epub+zip"
        : b.bookType === "CBX"
          ? "application/x-cbz"
          : "application/octet-stream";
  return `<entry>
    <title>${escapeXml(title)}</title>
    <id>urn:tsundoku:book:${b.id}</id>
    <updated>${new Date(b.addedOn).toISOString()}</updated>
    <author><name>${escapeXml(author)}</name></author>
    <link rel="http://opds-spec.org/image/thumbnail" href="/api/v1/books/${b.id}/cover" type="image/jpeg"/>
    <link rel="http://opds-spec.org/acquisition" href="/api/v1/files/${b.id}/stream" type="${mime}"/>
  </entry>`;
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
    const user = await basicAuth(c.req.header("Authorization"));
    if (!user) return unauthorized();
    return xmlResponse(
      feed({
        id: "urn:tsundoku:catalog:root",
        title: "tsundoku",
        self: "/api/v1/opds",
        entries: [
          `<entry>
    <title>Recent</title>
    <id>urn:tsundoku:catalog:recent</id>
    <updated>${new Date().toISOString()}</updated>
    <link rel="subsection" href="/api/v1/opds/recent" type="application/atom+xml;profile=opds-catalog;kind=acquisition"/>
    <content type="text">Newest additions</content>
  </entry>`,
          `<entry>
    <title>Libraries</title>
    <id>urn:tsundoku:catalog:libraries</id>
    <updated>${new Date().toISOString()}</updated>
    <link rel="subsection" href="/api/v1/opds/libraries" type="application/atom+xml;profile=opds-catalog;kind=navigation"/>
  </entry>`,
          `<entry>
    <title>Authors</title>
    <id>urn:tsundoku:catalog:authors</id>
    <updated>${new Date().toISOString()}</updated>
    <link rel="subsection" href="/api/v1/opds/authors" type="application/atom+xml;profile=opds-catalog;kind=navigation"/>
  </entry>`,
          `<entry>
    <title>Shelves</title>
    <id>urn:tsundoku:catalog:shelves</id>
    <updated>${new Date().toISOString()}</updated>
    <link rel="subsection" href="/api/v1/opds/shelves" type="application/atom+xml;profile=opds-catalog;kind=navigation"/>
  </entry>`,
          `<entry>
    <title>In progress</title>
    <id>urn:tsundoku:catalog:in-progress</id>
    <updated>${new Date().toISOString()}</updated>
    <link rel="subsection" href="/api/v1/opds/in-progress" type="application/atom+xml;profile=opds-catalog;kind=acquisition"/>
    <content type="text">Books you've started but not finished</content>
  </entry>`,
          `<entry>
    <title>Series</title>
    <id>urn:tsundoku:catalog:series</id>
    <updated>${new Date().toISOString()}</updated>
    <link rel="subsection" href="/api/v1/opds/series" type="application/atom+xml;profile=opds-catalog;kind=navigation"/>
  </entry>`,
        ],
      }),
    );
  })
  .get("/opds/recent", async (c) => {
    const user = await basicAuth(c.req.header("Authorization"));
    if (!user) return unauthorized();
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
    const user = await basicAuth(c.req.header("Authorization"));
    if (!user) return unauthorized();
    const libs = await listLibrariesForUser(user.id, user.permissions.admin);
    return xmlResponse(
      feed({
        id: "urn:tsundoku:catalog:libraries",
        title: "Libraries",
        self: "/api/v1/opds/libraries",
        entries: libs.map(
          (l) => `<entry>
    <title>${escapeXml(l.name)}</title>
    <id>urn:tsundoku:library:${l.id}</id>
    <updated>${new Date().toISOString()}</updated>
    <link rel="subsection" href="/api/v1/opds/libraries/${l.id}" type="application/atom+xml;profile=opds-catalog;kind=acquisition"/>
  </entry>`,
        ),
      }),
    );
  })
  .get("/opds/libraries/:id", async (c) => {
    const user = await basicAuth(c.req.header("Authorization"));
    if (!user) return unauthorized();
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
    const user = await basicAuth(c.req.header("Authorization"));
    if (!user) return unauthorized();
    const authors = await listAuthors();
    return xmlResponse(
      feed({
        id: "urn:tsundoku:catalog:authors",
        title: "Authors",
        self: "/api/v1/opds/authors",
        entries: authors.map(
          (a) => `<entry>
    <title>${escapeXml(a.name)}</title>
    <id>urn:tsundoku:author:${a.id}</id>
    <updated>${new Date().toISOString()}</updated>
    <content type="text">${a.bookCount} books</content>
  </entry>`,
        ),
      }),
    );
  })
  .get("/opds/series", async (c) => {
    const user = await basicAuth(c.req.header("Authorization"));
    if (!user) return unauthorized();
    const series = await listSeries();
    return xmlResponse(
      feed({
        id: "urn:tsundoku:catalog:series",
        title: "Series",
        self: "/api/v1/opds/series",
        entries: series.map(
          (s) => `<entry>
    <title>${escapeXml(s.name)}</title>
    <id>urn:tsundoku:series:${encodeURIComponent(s.name)}</id>
    <updated>${new Date().toISOString()}</updated>
    <content type="text">${s.bookCount} books</content>
  </entry>`,
        ),
      }),
    );
  })
  .get("/opds/shelves", async (c) => {
    const user = await basicAuth(c.req.header("Authorization"));
    if (!user) return unauthorized();
    const shelves = await listShelves(user.id);
    return xmlResponse(
      feed({
        id: "urn:tsundoku:catalog:shelves",
        title: "Shelves",
        self: "/api/v1/opds/shelves",
        entries: shelves.map(
          (s) => `<entry>
    <title>${escapeXml(s.name)}</title>
    <id>urn:tsundoku:shelf:${s.id}</id>
    <updated>${new Date().toISOString()}</updated>
    <link rel="subsection" href="/api/v1/opds/shelves/${s.id}" type="application/atom+xml;profile=opds-catalog;kind=acquisition"/>
    <content type="text">${s.bookCount} books</content>
  </entry>`,
        ),
      }),
    );
  })
  .get("/opds/shelves/:id", async (c) => {
    const user = await basicAuth(c.req.header("Authorization"));
    if (!user) return unauthorized();
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
        entries: books.map((b) =>
          bookEntry({
            id: b.id,
            fileName: b.fileName,
            bookType: b.bookType,
            addedOn: new Date(),
            title: b.title,
            authors: b.authors,
          }),
        ),
      }),
      "acquisition",
    );
  })
  .get("/opds/in-progress", async (c) => {
    const user = await basicAuth(c.req.header("Authorization"));
    if (!user) return unauthorized();
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
        entries: books.map((b) =>
          bookEntry({
            id: b.id,
            fileName: b.fileName,
            bookType: b.bookType,
            addedOn: new Date(),
            title: b.title,
            authors: b.authors,
          }),
        ),
      }),
      "acquisition",
    );
  })
  .get("/opds/series/:name", async (c) => {
    const user = await basicAuth(c.req.header("Authorization"));
    if (!user) return unauthorized();
    const raw = c.req.param("name");
    if (!raw) return new Response("Bad series", { status: 400 });
    const name = decodeURIComponent(raw);
    // OPDS shouldn't enforce per-library ACLs the same way the JSON API does;
    // we still scope to the user's allowed libraries.
    const allowedSet = await (async () => {
      if (user.permissions.admin) return "all" as const;
      const db = requireDb();
      const rows = await db
        .select({ libraryId: schema.userLibraryMapping.libraryId })
        .from(schema.userLibraryMapping)
        .where(eq(schema.userLibraryMapping.userId, user.id));
      return rows.map((r) => r.libraryId);
    })();
    const books = await getSeriesBooks(name, allowedSet);
    return xmlResponse(
      feed({
        id: `urn:tsundoku:series:${encodeURIComponent(name)}`,
        title: name,
        self: `/api/v1/opds/series/${encodeURIComponent(name)}`,
        kind: "acquisition",
        entries: books.map((b) =>
          bookEntry({
            id: b.id,
            fileName: b.fileName,
            bookType: b.bookType,
            addedOn: new Date(),
            title: b.title,
            authors: [],
          }),
        ),
      }),
      "acquisition",
    );
  })
  .get("/opds/search", async (c) => {
    const user = await basicAuth(c.req.header("Authorization"));
    if (!user) return unauthorized();
    const q = c.req.query("q") ?? "";
    const books = q
      ? await listBooks(user.id, user.permissions.admin, { search: q, size: 100 })
      : { content: [] as Awaited<ReturnType<typeof listBooks>>["content"] };
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
