import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppVariables, AuthUser } from "../types/app-variables";
import { fail, handleValidationError } from "../http/errors";
import {
  getAllLibraries,
  getLibraryById,
  getLibraryPathsByLibraryId,
  createLibrary,
  updateLibrary,
  deleteLibrary,
  setFileNamingPattern,
  getLibrariesByUserId,
  checkLibraryAccess,
  type LibraryRow,
  type LibraryPathRow,
} from "../services/library-service";
import {
  getBookByLibraryAndId,
  getBooksByLibraryIdWithFilters,
  getFormatCountsForLibrary,
  type BookRow,
} from "../services/book-service";
import { createTask } from "../services/task-service";
import { enqueueTaskExecution, getActiveScanTaskForLibrary } from "../services/tasks/task-runner-service";
import { refreshWatcherForLibrary } from "../services/tasks/task-watch-service";

const libraryPathSchema = z.object({
  id: z.uuidv7().optional(),
  libraryId: z.uuidv7().optional(),
  path: z.string(),
});

const createLibrarySchema = z.object({
  name: z.string().min(1),
  icon: z.string().optional(),
  iconType: z.string().optional(),
  watch: z.boolean().optional(),
  paths: z.array(libraryPathSchema).min(1),
  formatPriority: z.array(z.string()).optional(),
  allowedFormats: z.array(z.string()).optional(),
  metadataSource: z.string().optional(),
  organizationMode: z.string().optional(),
});

const updateLibrarySchema = z.object({
  name: z.string().min(1).optional(),
  icon: z.string().optional(),
  iconType: z.string().optional(),
  watch: z.boolean().optional(),
  paths: z.array(libraryPathSchema).optional(),
  formatPriority: z.array(z.string()).optional(),
  allowedFormats: z.array(z.string()).optional(),
  metadataSource: z.string().optional(),
  organizationMode: z.string().optional(),
});

const fileNamingPatternSchema = z.object({
  fileNamingPattern: z.string(),
});

interface LibraryResponse {
  id: string;
  name: string;
  sort: string | null;
  icon: string;
  iconType: string | null;
  fileNamingPattern: string | null;
  watch: boolean;
  paths: { id: string; path: string | null }[];
  formatPriority: string[] | null;
  allowedFormats: string[] | null;
  organizationMode: string | null;
  metadataSource: string | null;
}

const mapRowToResponse = async (row: LibraryRow): Promise<LibraryResponse> => {
  const paths = await getLibraryPathsByLibraryId(row.id);
  return {
    id: row.id,
    name: row.name,
    sort: row.sort,
    icon: row.icon,
    iconType: row.iconType,
    fileNamingPattern: row.fileNamingPattern,
    watch: row.watch,
    paths: paths.map((p: LibraryPathRow) => ({ id: p.id, path: p.path })),
    formatPriority: row.formatPriority,
    allowedFormats: row.allowedFormats,
    organizationMode: row.organizationMode,
    metadataSource: row.metadataSource,
  };
};

const getAuthUser = (c: import("hono").Context): AuthUser => {
  const authUser = c.get("authUser");
  if (!authUser) {
    fail(401, "Unauthorized");
  }
  return authUser as AuthUser;
};

const requireAdminOrLibraryManager = async (
  c: import("hono").Context,
  next: () => Promise<void>,
) => {
  const authUser = getAuthUser(c);

  if (!authUser.isAdmin) {
    fail(403, "Forbidden: admin permission required");
  }

  await next();
};

const requireLibraryAccess = (libraryIdParam: string = "libraryId") => {
  return async (c: import("hono").Context, next: () => Promise<void>) => {
    const authUser = getAuthUser(c);

    const libraryIdRaw = c.req.param(libraryIdParam);
    const parsed = z.uuidv7().safeParse(libraryIdRaw);
    if (!parsed.success) {
      fail(400, "Invalid library ID");
    }

    const hasAccess = await checkLibraryAccess(
      libraryIdRaw as string,
      authUser.userId,
      authUser.isAdmin,
    );
    if (!hasAccess) {
      fail(403, "Access denied to this library");
    }

    await next();
  };
};

export const libraryRoutes = new Hono<{ Variables: AppVariables }>();

libraryRoutes.get("/", async (c) => {
  const authUser = getAuthUser(c);

  let libraries: LibraryRow[];
  if (authUser.isAdmin) {
    libraries = await getAllLibraries();
  } else {
    libraries = await getLibrariesByUserId(authUser.userId);
  }

  const results = await Promise.all(libraries.map(mapRowToResponse));
  return c.json(results, 200);
});

libraryRoutes.get("/health", async (c) => {
  const libraries = await getAllLibraries();
  const health: Record<string, boolean> = {};

  for (const library of libraries) {
    const paths = await getLibraryPathsByLibraryId(library.id);
    let accessible = false;
    for (const libPath of paths) {
      if (libPath.path) {
        try {
          const dir = await Bun.file(libPath.path).exists();
          if (dir) {
            accessible = true;
            break;
          }
        } catch {
          // Ignore errors, path not accessible
        }
      }
    }
    health[library.id] = accessible;
  }

  return c.json(health, 200);
});

libraryRoutes.get(
  "/:libraryId",
  requireLibraryAccess("libraryId"),
  async (c) => {
    const libraryIdRaw = c.req.param("libraryId");
    const libraryId = libraryIdRaw ?? "";

    const library = await getLibraryById(libraryId);
    if (!library) {
      fail(404, `Library not found: ${libraryId}`);
    }

    const response = await mapRowToResponse(library as LibraryRow);
    return c.json(response, 200);
  },
);

libraryRoutes.post(
  "/",
  requireAdminOrLibraryManager,
  zValidator("json", createLibrarySchema, handleValidationError),
  async (c) => {
    const authUser = getAuthUser(c);

    const payload = c.req.valid("json");

    const library = await createLibrary(payload, authUser.userId);
    const response = await mapRowToResponse(library);

    return c.json(response, 200);
  },
);

libraryRoutes.put(
  "/:libraryId",
  requireLibraryAccess("libraryId"),
  requireAdminOrLibraryManager,
  zValidator("json", updateLibrarySchema, handleValidationError),
  async (c) => {
    const libraryIdRaw = c.req.param("libraryId");
    const libraryId = libraryIdRaw ?? "";

    const payload = c.req.valid("json");

    const library = await updateLibrary(libraryId, payload);
    const response = await mapRowToResponse(library);

    return c.json(response, 200);
  },
);

libraryRoutes.delete(
  "/:libraryId",
  requireLibraryAccess("libraryId"),
  requireAdminOrLibraryManager,
  async (c) => {
    const libraryIdRaw = c.req.param("libraryId");
    const libraryId = libraryIdRaw ?? "";

    await deleteLibrary(libraryId);

    return c.body(null, 204);
  },
);

libraryRoutes.get(
  "/:libraryId/book/:bookId",
  requireLibraryAccess("libraryId"),
  async (c) => {
    const libraryId = c.req.param("libraryId");
    const bookId = c.req.param("bookId");

    const book = await getBookByLibraryAndId(libraryId, bookId);
    if (!book) {
      fail(404, `Book not found: ${bookId}`);
    }

    return c.json(book, 200);
  },
);

libraryRoutes.get(
  "/:libraryId/book",
  requireLibraryAccess("libraryId"),
  async (c) => {
    const libraryId = c.req.param("libraryId");
    const limit = c.req.query("limit");
    const offset = c.req.query("offset");
    const format = c.req.query("format");

    const books = await getBooksByLibraryIdWithFilters(libraryId, {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      format: format ?? undefined,
    });

    return c.json(books, 200);
  },
);

libraryRoutes.put(
  "/:libraryId/refresh",
  requireLibraryAccess("libraryId"),
  requireAdminOrLibraryManager,
  async (c) => {
    const libraryIdRaw = c.req.param("libraryId");
    if (!libraryIdRaw) {
      return c.json({ status: 400, message: "Library ID is required" }, 400);
    }
    const libraryId = libraryIdRaw;
    const authUser = getAuthUser(c);

    const existingTask = await getActiveScanTaskForLibrary(libraryId);
    if (existingTask) {
      return c.json({
        status: 409,
        message: "A scan is already running for this library",
        data: { taskId: existingTask.id },
      }, 409);
    }

    const task = await createTask("SCAN_LIBRARY", authUser.userId, {
      libraryId,
    });

    enqueueTaskExecution(task.id);

    await refreshWatcherForLibrary(libraryId);

    return c.json({
      status: 202,
      message: "Library scan started",
      data: { taskId: task.id },
    }, 202);
  },
);

libraryRoutes.patch(
  "/:libraryId/file-naming-pattern",
  requireLibraryAccess("libraryId"),
  requireAdminOrLibraryManager,
  zValidator("json", fileNamingPatternSchema, handleValidationError),
  async (c) => {
    const libraryId = c.req.param("libraryId");
    const payload = c.req.valid("json");

    const library = await setFileNamingPattern(
      libraryId,
      payload.fileNamingPattern,
    );
    const response = await mapRowToResponse(library);

    return c.json(response, 200);
  },
);

libraryRoutes.post(
  "/scan",
  requireAdminOrLibraryManager,
  zValidator("json", createLibrarySchema, handleValidationError),
  async (c) => {
    const payload = c.req.valid("json");

    let count = 0;
    if (payload.paths && payload.paths.length > 0) {
      for (const libPath of payload.paths) {
        if (libPath.path) {
          try {
            const file = Bun.file(libPath.path);
            const exists = await file.exists();
            if (exists) {
              count++;
            }
          } catch {
            // Path not accessible
          }
        }
      }
    }

    return c.json(count, 200);
  },
);

libraryRoutes.get(
  "/:libraryId/format-counts",
  requireLibraryAccess("libraryId"),
  async (c) => {
    const libraryId = c.req.param("libraryId");

    const counts = await getFormatCountsForLibrary(libraryId);
    return c.json(counts, 200);
  },
);
