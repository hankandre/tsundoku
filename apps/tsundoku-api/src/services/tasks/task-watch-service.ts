import { watch } from "fs";
import { WatchEventBuffer } from "./watch-event-buffer";
import { enqueueTaskExecution, getTaskById } from "./task-runner-service";
import { createTask } from "../task-service";
import { getAllLibraries, getLibraryPathsByLibraryId } from "../library-service";
import { logger } from "../../config/logger";

const SUPPORTED_EXTENSIONS = new Set([".epub"]);

const libraryWatchers: Map<string, ReturnType<typeof watch>> = new Map();
const eventBuffer = new WatchEventBuffer();

const getLibraryPathKey = (libraryId: string, libraryPath: string): string =>
  `${libraryId}:${libraryPath}`;

const isWatchedLibraryPath = async (libraryId: string, filePath: string): Promise<boolean> => {
  const libraryPaths = await getLibraryPathsByLibraryId(libraryId);
  for (const libPath of libraryPaths) {
    if (libPath.path && filePath.startsWith(libPath.path)) {
      return true;
    }
  }
  return false;
};

const handleFileEvent = async (eventType: string, filePath: string): Promise<void> => {
  const extension = filePath.substring(filePath.lastIndexOf(".")).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    return;
  }

  logger.info({ eventType, filePath }, "Library file event detected");

  const libraries = await getAllLibraries();
  for (const library of libraries) {
    if (library.watch !== true) {
      continue;
    }

    const libPaths = await getLibraryPathsByLibraryId(library.id);
    for (const libPath of libPaths) {
      if (!libPath.path) {
        continue;
      }

      if (!filePath.startsWith(libPath.path)) {
        continue;
      }

      eventBuffer.schedule(
        getLibraryPathKey(library.id, libPath.path),
        2000,
        async () => {
          logger.info({ libraryId: library.id, path: libPath.path }, "Scheduling library scan due to file change");
          const task = await import("../task-service").then((m) => m.createTask("SCAN_LIBRARY", "system", { libraryId: library.id }));
          enqueueTaskExecution(task.id);
        },
      );
    }
  }
};

const startWatchingLibraryPath = (libraryId: string, libraryPath: string): void => {
  const key = getLibraryPathKey(libraryId, libraryPath);
  if (libraryWatchers.has(key)) {
    return;
  }

  try {
    const watcher = watch(libraryPath, { recursive: true }, (event, filename) => {
      if (!filename) {
        return;
      }

      const fullPath = `${libraryPath}/${filename}`;
      void handleFileEvent(event, fullPath);
    });

    watcher.on("error", (error) => {
      logger.error({ error, libraryId, path: libraryPath }, "Library watcher error");
    });

    libraryWatchers.set(key, watcher);
    logger.info({ libraryId, path: libraryPath }, "Started watching library path");
  } catch (error) {
    logger.error({ error, libraryId, path: libraryPath }, "Failed to start library watcher");
  }
};

const stopWatchingLibraryPath = (libraryId: string, libraryPath: string): void => {
  const key = getLibraryPathKey(libraryId, libraryPath);
  const watcher = libraryWatchers.get(key);
  if (watcher) {
    watcher.close();
    libraryWatchers.delete(key);
    logger.info({ libraryId, path: libraryPath }, "Stopped watching library path");
  }
};

export const startLibraryWatchers = async (): Promise<void> => {
  const libraries = await getAllLibraries();
  for (const library of libraries) {
    if (library.watch !== true) {
      continue;
    }

    const libraryPaths = await getLibraryPathsByLibraryId(library.id);
    for (const libPath of libraryPaths) {
      if (libPath.path) {
        startWatchingLibraryPath(library.id, libPath.path);
      }
    }
  }
};

export const reconcileLibraryOnStartup = async (): Promise<void> => {
  logger.info("Starting library reconciliation scan on startup");

  const libraries = await getAllLibraries();
  const watchedLibraries = libraries.filter((lib) => lib.watch === true);

  if (watchedLibraries.length === 0) {
    logger.info("No watched libraries to reconcile");
    return;
  }

  logger.info({ count: watchedLibraries.length }, "Starting reconciliation scan for watched libraries");

  const systemUserId = "00000000-0000-0000-0000-000000000001";

  for (const library of watchedLibraries) {
    try {
      const task = await createTask("SCAN_LIBRARY", systemUserId, {
        libraryId: library.id,
      });
      enqueueTaskExecution(task.id);
      logger.info({ libraryId: library.id, taskId: task.id }, "Enqueued reconciliation scan task");
    } catch (error) {
      logger.error({ error, libraryId: library.id }, "Failed to enqueue reconciliation scan");
    }
  }
};

export const stopLibraryWatchers = (): void => {
  for (const [key, watcher] of libraryWatchers) {
    watcher.close();
  }
  libraryWatchers.clear();
  eventBuffer.dispose();
  logger.info("All library watchers stopped");
};

export const refreshWatcherForLibrary = async (libraryId: string): Promise<void> => {
  const library = await import("../library-service").then((m) => m.getLibraryById(libraryId));
  if (!library) {
    return;
  }

  const libraryPaths = await getLibraryPathsByLibraryId(libraryId);
  for (const libPath of libraryPaths) {
    if (!libPath.path) {
      continue;
    }

    stopWatchingLibraryPath(libraryId, libPath.path);
    if (library.watch) {
      startWatchingLibraryPath(libraryId, libPath.path);
    }
  }
};
