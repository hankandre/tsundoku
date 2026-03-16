import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "bun:test";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createIntegrationDatabase,
  closeIntegrationDatabase,
  getIntegrationDatabase,
} from "./pglite-setup";
import { schema } from "../test-utils";

const testUserId = "0192ac41-7c1b-7a3b-8c6d-4e5f6a7b8c9d";
const testLibraryId = "0192ac3d-7c1b-7a3b-8c6d-4e5f6a7b8c9d";
const testLibraryPathId = "0192ac40-7c1b-7a3b-8c6d-4e5f6a7b8c9d";
const testBookId = "0192ac3e-7c1b-7a3b-8c6d-4e5f6a7b8c9d";
const secondBookId = "0192ac42-7c1b-7a3b-8c6d-4e5f6a7b8c9d";
const testShelfId = "0192ac3f-7c1b-7a3b-8c6d-4e5f6a7b8c9d";

const authUser = {
  userId: testUserId,
  username: "test-user",
  isDefaultPassword: false,
  isAdmin: false,
  canManageLibrary: true,
  canAccessUserStats: true,
};

let app: Awaited<typeof import("../../src/app")>["app"];
let appImportCounter = 0;
let testLibraryRootPath = "";

const createLibraryFiles = async () => {
  testLibraryRootPath = await mkdtemp(join(tmpdir(), "tsundoku-reader-flow-"));
  await mkdir(join(testLibraryRootPath, "fiction"), { recursive: true });
  await Bun.write(join(testLibraryRootPath, "fiction/book-one.epub"), "epub-content");
  await Bun.write(join(testLibraryRootPath, "fiction/book-two.pdf"), "pdf-content");
};

const seedBaseData = async () => {
  const database = getIntegrationDatabase();

  await database.insert(schema.users).values({
    id: testUserId,
    username: "test-user",
    passwordHash: "hash",
    name: "Test User",
    email: "test@example.com",
  });

  await database.insert(schema.libraries).values({
    id: testLibraryId,
    name: "Main Library",
    icon: "library",
    watch: false,
    createdBy: testUserId,
    updatedBy: testUserId,
  });

  await database.insert(schema.libraryPath).values({
    id: testLibraryPathId,
    path: testLibraryRootPath,
    libraryId: testLibraryId,
  });

  await database.insert(schema.userLibraryMapping).values({
    userId: testUserId,
    libraryId: testLibraryId,
  });

  await database.insert(schema.books).values([
    {
      id: testBookId,
      fileName: "book-one.epub",
      fileSubPath: "fiction/book-one.epub",
      bookType: "epub",
      libraryId: testLibraryId,
      libraryPathId: testLibraryPathId,
      createdBy: testUserId,
      updatedBy: testUserId,
    },
    {
      id: secondBookId,
      fileName: "book-two.pdf",
      fileSubPath: "fiction/book-two.pdf",
      bookType: "pdf",
      libraryId: testLibraryId,
      libraryPathId: testLibraryPathId,
      createdBy: testUserId,
      updatedBy: testUserId,
    },
  ]);

  await database.insert(schema.shelves).values({
    id: testShelfId,
    userId: testUserId,
    name: "Currently Reading",
    icon: "bookmark",
    isPublic: false,
    createdBy: testUserId,
    updatedBy: testUserId,
  });
};

describe("core reading flow routes with pglite", () => {
  beforeEach(async () => {
    await createIntegrationDatabase();
    await createLibraryFiles();
    appImportCounter += 1;
    const appModulePath = `../../src/app.ts?core-reading-flow-${appImportCounter}`;
    const appModule = await import(appModulePath);
    app = appModule.createApp({
      authMiddlewareOverride: async (context, next) => {
        context.set("authUser", authUser);
        await next();
      },
    });
    await seedBaseData();
  });

  afterEach(async () => {
    await closeIntegrationDatabase();
    if (testLibraryRootPath) {
      await rm(testLibraryRootPath, { recursive: true, force: true });
      testLibraryRootPath = "";
    }
  });

  it("gets a library book by id", async () => {
    const response = await app.request(
      `/api/v1/libraries/${testLibraryId}/book/${testBookId}`,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.id).toBe(testBookId);
  });

  it("gets library books", async () => {
    const response = await app.request(
      `/api/v1/libraries/${testLibraryId}/book`,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toBeArray();
    expect(body).toHaveLength(2);
  });

  it("gets format counts for library", async () => {
    const response = await app.request(
      `/api/v1/libraries/${testLibraryId}/format-counts`,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.epub).toBe(1);
    expect(body.pdf).toBe(1);
  });

  it("gets books in a shelf", async () => {
    const database = getIntegrationDatabase();
    await database.insert(schema.bookShelfMapping).values({
      shelfId: testShelfId,
      bookId: testBookId,
      createdBy: testUserId,
    });

    const response = await app.request(`/api/v1/shelves/${testShelfId}/books`);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toBeArray();
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe(testBookId);
  });

  it("updates user book progress", async () => {
    const response = await app.request("/api/v1/books/progress", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        bookId: testBookId,
        progress: 50,
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
  });

  it("updates read status for books", async () => {
    const response = await app.request("/api/v1/books/status", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        bookIds: [testBookId],
        status: "READING",
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
  });

  it("resets progress for books", async () => {
    const database = getIntegrationDatabase();
    await database.insert(schema.userBookProgress).values({
      userId: testUserId,
      bookId: testBookId,
      epubProgress: "80",
      createdBy: testUserId,
    });

    const response = await app.request("/api/v1/books/reset-progress", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        bookIds: [testBookId],
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
  });

  it("updates personal rating", async () => {
    const response = await app.request("/api/v1/books/personal-rating", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ids: [testBookId],
        rating: 4,
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
  });

  it("resets personal rating", async () => {
    const database = getIntegrationDatabase();
    await database.insert(schema.userBookProgress).values({
      userId: testUserId,
      bookId: testBookId,
      personalRating: 5,
      createdBy: testUserId,
    });

    const response = await app.request("/api/v1/books/reset-personal-rating", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        bookIds: [testBookId],
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
  });

  it("assigns books to shelves", async () => {
    const response = await app.request("/api/v1/books/shelves", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        bookIds: [testBookId],
        shelvesToAssign: [testShelfId],
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
  });

  it("supports pagination for library books", async () => {
    const response = await app.request(
      `/api/v1/libraries/${testLibraryId}/book?limit=1&offset=0`,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.length).toBe(1);
  });

  it("supports format filter for library books", async () => {
    const response = await app.request(
      `/api/v1/libraries/${testLibraryId}/book?format=epub`,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveLength(1);
    expect(body[0].bookType).toBe("epub");
  });

  it("streams book content", async () => {
    const response = await app.request(`/api/v1/books/${testBookId}/content`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/epub+zip");
    expect(await response.text()).toBe("epub-content");
  });

  it("downloads a single book file as attachment", async () => {
    const response = await app.request(`/api/v1/books/${testBookId}/download`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain(
      'attachment; filename="book-one.epub"',
    );
    expect(await response.text()).toBe("epub-content");
  });

  it("downloads all book files", async () => {
    const response = await app.request(`/api/v1/books/${testBookId}/download-all`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain(
      'attachment; filename="book-one.epub"',
    );
    expect(await response.text()).toBe("epub-content");
  });

  it("gets and updates viewer settings", async () => {
    const initialResponse = await app.request(`/api/v1/books/${testBookId}/viewer-setting`);
    expect(initialResponse.status).toBe(200);
    expect(await initialResponse.json()).toEqual({});

    const updateResponse = await app.request(`/api/v1/books/${testBookId}/viewer-setting`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ebookSettings: {
          fontFamily: "Literata",
          fontSize: 20,
          gap: 6,
          hyphenate: true,
          isDark: false,
          justify: true,
          lineHeight: 140,
          maxBlockSize: 40,
          maxColumnCount: 2,
          maxInlineSize: 95,
          theme: "sepia",
          flow: "paginated",
        },
      }),
    });

    expect(updateResponse.status).toBe(204);

    const afterUpdateResponse = await app.request(`/api/v1/books/${testBookId}/viewer-setting`);
    expect(afterUpdateResponse.status).toBe(200);
    const body = await afterUpdateResponse.json();
    expect(body.ebookSettings.fontFamily).toBe("Literata");
    expect(body.ebookSettings.fontSize).toBe(20);
    expect(body.ebookSettings.flow).toBe("paginated");
  });

  it("toggles physical flag for a book", async () => {
    const response = await app.request(
      `/api/v1/books/${testBookId}/physical?physical=true`,
      {
        method: "PATCH",
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.id).toBe(testBookId);
    expect(body.isPhysical).toBe(true);

    const database = getIntegrationDatabase();
    const persistedBook = await database.query.books.findFirst({
      where: (books, operators) => operators.eq(books.id, testBookId),
    });

    expect(persistedBook?.isPhysical).toBe(true);
  });
});
