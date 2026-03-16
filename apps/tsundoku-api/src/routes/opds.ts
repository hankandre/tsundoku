import { Hono } from "hono";
import { Feed, Entry } from "opds-ts/v1.2";
import type { AppVariables } from "../types/app-variables";
import { validateOpdsUser } from "../services/opds-service";
import { fail } from "../http/errors";
import { getAllBooks, getBookById, getBooksByLibraryId, getBookMetadata } from "../services/book-service";
import { getAllLibraries } from "../services/library-service";
import { getAllShelvesForUser } from "../services/shelf-service";

const OPDS_CATALOG_MEDIA_TYPE =
  "application/atom+xml;profile=opds-catalog;kind=navigation;charset=utf-8";
const OPDS_ACQUISITION_MEDIA_TYPE =
  "application/atom+xml;profile=opds-catalog;kind=acquisition;charset=utf-8";

const opdsRoutes = new Hono<{ Variables: AppVariables }>();

const getBaseUrl = (c: import("hono").Context): string => {
  const protocol = c.req.header("x-forwarded-proto") || "http";
  const host = c.req.header("host") || "localhost:6060";
  return `${protocol}://${host}`;
};

const authenticateOpdsUser = async (c: import("hono").Context) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Basic ")) {
    fail(401, "Unauthorized");
    return null;
  }

  const base64Credentials = authHeader.slice(6);
  const credentials = atob(base64Credentials);
  const [username, password] = credentials.split(":");

  const user = await validateOpdsUser(username, password);
  if (!user) {
    fail(401, "Invalid credentials");
    return null;
  }

  return user;
};

interface BookWithMetadata {
  id: string;
  title: string | null;
  thumbnail: string | null;
}

const getBookWithMetadata = async (bookId: string): Promise<BookWithMetadata | null> => {
  const book = await getBookById(bookId);
  if (!book) return null;
  
  const metadata = await getBookMetadata(bookId);
  return {
    id: book.id,
    title: metadata?.title ?? "Untitled",
    thumbnail: metadata?.thumbnail ?? null,
  };
};

const getAllBooksWithMetadata = async (userId: string): Promise<BookWithMetadata[]> => {
  const books = await getAllBooks();
  const result: BookWithMetadata[] = [];
  
  for (const book of books) {
    const metadata = await getBookMetadata(book.id);
    result.push({
      id: book.id,
      title: metadata?.title ?? "Untitled",
      thumbnail: metadata?.thumbnail ?? null,
    });
  }
  
  return result;
};

const getLibraryBooksWithMetadata = async (libraryId: string, _userId: string): Promise<BookWithMetadata[]> => {
  const books = await getBooksByLibraryId(libraryId);
  const result: BookWithMetadata[] = [];
  
  for (const book of books) {
    const metadata = await getBookMetadata(book.id);
    result.push({
      id: book.id,
      title: metadata?.title ?? "Untitled",
      thumbnail: metadata?.thumbnail ?? null,
    });
  }
  
  return result;
};

opdsRoutes.get("/", async (c) => {
  const user = await authenticateOpdsUser(c);
  if (!user) return c.body(null, 401);

  const baseUrl = getBaseUrl(c);
  const feed = new Feed("urn:tsundoku:root", "Tsundoku")
    .setKind("navigation")
    .addSelfLink(`${baseUrl}/opds/`)
    .addEntry(new Entry("nav:libraries", "Libraries").addSubsection(`${baseUrl}/opds/libraries`, "navigation"))
    .addEntry(new Entry("nav:shelves", "Shelves").addSubsection(`${baseUrl}/opds/shelves`, "navigation"))
    .addEntry(new Entry("nav:magic-shelves", "Magic Shelves").addSubsection(`${baseUrl}/opds/magic-shelves`, "navigation"))
    .addEntry(new Entry("nav:catalog", "All Books").addSubsection(`${baseUrl}/opds/catalog`, "acquisition"));

  const feedXml = feed.toXml({ baseUrl });
  return c.text(feedXml, 200, { "Content-Type": OPDS_CATALOG_MEDIA_TYPE });
});

opdsRoutes.get("/libraries", async (c) => {
  const user = await authenticateOpdsUser(c);
  if (!user) return c.body(null, 401);

  const baseUrl = getBaseUrl(c);
  const libraries = await getAllLibraries();

  const feed = new Feed("urn:tsundoku:libraries", "Libraries")
    .setKind("navigation")
    .addSelfLink(`${baseUrl}/opds/libraries`);

  for (const lib of libraries) {
    const entry = new Entry(`lib:${lib.id}`, lib.name ?? "Unnamed Library")
      .addSubsection(`${baseUrl}/opds/libraries/${lib.id}`, "acquisition");
    feed.addEntry(entry);
  }

  const feedXml = feed.toXml({ baseUrl });
  return c.text(feedXml, 200, { "Content-Type": OPDS_CATALOG_MEDIA_TYPE });
});

opdsRoutes.get("/libraries/:libraryId", async (c) => {
  const user = await authenticateOpdsUser(c);
  if (!user) return c.body(null, 401);

  const libraryId = c.req.param("libraryId");
  const baseUrl = getBaseUrl(c);
  const books = await getLibraryBooksWithMetadata(libraryId, user.userId);

  const feed = new Feed(`urn:tsundoku:library:${libraryId}`, "Library Books")
    .setKind("acquisition")
    .addSelfLink(`${baseUrl}/opds/libraries/${libraryId}`);

  for (const book of books) {
    const entry = new Entry(`book:${book.id}`, book.title ?? "Untitled")
      .addAcquisition(`${baseUrl}/opds/${book.id}/download`, "application/epub+zip", "open-access")
      .addImage(`${baseUrl}/opds/${book.id}/cover`);
    feed.addEntry(entry);
  }

  const feedXml = feed.toXml({ baseUrl });
  return c.text(feedXml, 200, { "Content-Type": OPDS_ACQUISITION_MEDIA_TYPE });
});

opdsRoutes.get("/shelves", async (c) => {
  const user = await authenticateOpdsUser(c);
  if (!user) return c.body(null, 401);

  const baseUrl = getBaseUrl(c);
  const shelves = await getAllShelvesForUser(user.userId);

  const feed = new Feed("urn:tsundoku:shelves", "Shelves")
    .setKind("navigation")
    .addSelfLink(`${baseUrl}/opds/shelves`);

  for (const shelf of shelves) {
    const entry = new Entry(`shelf:${shelf.id}`, shelf.name ?? "Unnamed Shelf")
      .addSubsection(`${baseUrl}/opds/shelves/${shelf.id}`, "acquisition");
    feed.addEntry(entry);
  }

  const feedXml = feed.toXml({ baseUrl });
  return c.text(feedXml, 200, { "Content-Type": OPDS_CATALOG_MEDIA_TYPE });
});

opdsRoutes.get("/shelves/:shelfId", async (c) => {
  const user = await authenticateOpdsUser(c);
  if (!user) return c.body(null, 401);

  const shelfId = c.req.param("shelfId");
  const baseUrl = getBaseUrl(c);

  const feed = new Feed(`urn:tsundoku:shelf:${shelfId}`, "Shelf Books")
    .setKind("acquisition")
    .addSelfLink(`${baseUrl}/opds/shelves/${shelfId}`);

  const feedXml = feed.toXml({ baseUrl });
  return c.text(feedXml, 200, { "Content-Type": OPDS_ACQUISITION_MEDIA_TYPE });
});

opdsRoutes.get("/magic-shelves", async (c) => {
  const user = await authenticateOpdsUser(c);
  if (!user) return c.body(null, 401);

  const baseUrl = getBaseUrl(c);

  const feed = new Feed("urn:tsundoku:magic-shelves", "Magic Shelves")
    .setKind("navigation")
    .addSelfLink(`${baseUrl}/opds/magic-shelves`)
    .addEntry(
      new Entry("magic:all", "All Books").addSubsection(`${baseUrl}/opds/catalog`, "acquisition")
    )
    .addEntry(
      new Entry("magic:recent", "Recent").addSubsection(`${baseUrl}/opds/recent`, "acquisition")
    )
    .addEntry(
      new Entry("magic:surprise", "Surprise").addSubsection(`${baseUrl}/opds/surprise`, "acquisition")
    );

  const feedXml = feed.toXml({ baseUrl });
  return c.text(feedXml, 200, { "Content-Type": OPDS_CATALOG_MEDIA_TYPE });
});

opdsRoutes.get("/authors", async (c) => {
  const user = await authenticateOpdsUser(c);
  if (!user) return c.body(null, 401);

  const baseUrl = getBaseUrl(c);

  const feed = new Feed("urn:tsundoku:authors", "Authors")
    .setKind("navigation")
    .addSelfLink(`${baseUrl}/opds/authors`);

  const feedXml = feed.toXml({ baseUrl });
  return c.text(feedXml, 200, { "Content-Type": OPDS_CATALOG_MEDIA_TYPE });
});

opdsRoutes.get("/series", async (c) => {
  const user = await authenticateOpdsUser(c);
  if (!user) return c.body(null, 401);

  const baseUrl = getBaseUrl(c);

  const feed = new Feed("urn:tsundoku:series", "Series")
    .setKind("navigation")
    .addSelfLink(`${baseUrl}/opds/series`);

  const feedXml = feed.toXml({ baseUrl });
  return c.text(feedXml, 200, { "Content-Type": OPDS_CATALOG_MEDIA_TYPE });
});

opdsRoutes.get("/catalog", async (c) => {
  const user = await authenticateOpdsUser(c);
  if (!user) return c.body(null, 401);

  const baseUrl = getBaseUrl(c);
  const books = await getAllBooksWithMetadata(user.userId);

  const feed = new Feed("urn:tsundoku:catalog", "All Books")
    .setKind("acquisition")
    .addSelfLink(`${baseUrl}/opds/catalog`);

  for (const book of books) {
    const entry = new Entry(`book:${book.id}`, book.title ?? "Untitled")
      .addAcquisition(`${baseUrl}/opds/${book.id}/download`, "application/epub+zip", "open-access")
      .addImage(`${baseUrl}/opds/${book.id}/cover`);
    feed.addEntry(entry);
  }

  const feedXml = feed.toXml({ baseUrl });
  return c.text(feedXml, 200, { "Content-Type": OPDS_ACQUISITION_MEDIA_TYPE });
});

opdsRoutes.get("/recent", async (c) => {
  const user = await authenticateOpdsUser(c);
  if (!user) return c.body(null, 401);

  const baseUrl = getBaseUrl(c);
  const books = await getAllBooksWithMetadata(user.userId);

  const feed = new Feed("urn:tsundoku:recent", "Recent Books")
    .setKind("acquisition")
    .addSelfLink(`${baseUrl}/opds/recent`);

  for (const book of books.slice(0, 50)) {
    const entry = new Entry(`book:${book.id}`, book.title ?? "Untitled")
      .addAcquisition(`${baseUrl}/opds/${book.id}/download`, "application/epub+zip", "open-access")
      .addImage(`${baseUrl}/opds/${book.id}/cover`);
    feed.addEntry(entry);
  }

  const feedXml = feed.toXml({ baseUrl });
  return c.text(feedXml, 200, { "Content-Type": OPDS_ACQUISITION_MEDIA_TYPE });
});

opdsRoutes.get("/surprise", async (c) => {
  const user = await authenticateOpdsUser(c);
  if (!user) return c.body(null, 401);

  const baseUrl = getBaseUrl(c);
  const books = await getAllBooksWithMetadata(user.userId);
  const shuffled = books.sort(() => Math.random() - 0.5).slice(0, 10);

  const feed = new Feed("urn:tsundoku:surprise", "Surprise")
    .setKind("acquisition")
    .addSelfLink(`${baseUrl}/opds/surprise`);

  for (const book of shuffled) {
    const entry = new Entry(`book:${book.id}`, book.title ?? "Untitled")
      .addAcquisition(`${baseUrl}/opds/${book.id}/download`, "application/epub+zip", "open-access")
      .addImage(`${baseUrl}/opds/${book.id}/cover`);
    feed.addEntry(entry);
  }

  const feedXml = feed.toXml({ baseUrl });
  return c.text(feedXml, 200, { "Content-Type": OPDS_ACQUISITION_MEDIA_TYPE });
});

opdsRoutes.get("/:bookId/download", async (c) => {
  const user = await authenticateOpdsUser(c);
  if (!user) return c.body(null, 401);

  const bookId = c.req.param("bookId");
  const fileId = c.req.query("fileId");

  const book = await getBookById(bookId);
  if (!book) {
    return c.body("Book not found", 404);
  }

  fail(404, "Download not implemented yet");
  return c.body(null, 404);
});

opdsRoutes.get("/:bookId/cover", async (c) => {
  const user = await authenticateOpdsUser(c);
  if (!user) return c.body(null, 401);

  const bookId = c.req.param("bookId");
  const baseUrl = getBaseUrl(c);

  const book = await getBookWithMetadata(bookId);
  if (!book || !book.thumbnail) {
    return c.redirect(`${baseUrl}/assets/cover-placeholder.png`, 302);
  }

  return c.redirect(book.thumbnail, 302);
});

opdsRoutes.get("/search.opds", async (c) => {
  const user = await authenticateOpdsUser(c);
  if (!user) return c.body(null, 401);

  const searchDoc = `<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">
  <ShortName>Tsundoku</ShortName>
  <Description>Search books in Tsundoku</Description>
  <Url type="application/atom+xml" template="{searchTerms}"/>
</OpenSearchDescription>`;
  return c.text(searchDoc, 200, {
    "Content-Type": "application/opensearchdescription+xml;charset=utf-8",
  });
});

export { opdsRoutes };
