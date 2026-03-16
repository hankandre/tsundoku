import { fail } from "../http/errors";
import { readdirSync, existsSync, statSync } from "fs";

const BLOCKED_PATHS = ["/proc", "/sys", "/dev", "/run", "/var/run"];

export const getFoldersAtPath = (path: string): string[] => {
  const normalized = path.replace(/\\/g, "/");

  const isBlocked = BLOCKED_PATHS.some(
    (blocked) => normalized === blocked || normalized.startsWith(blocked + "/")
  );

  if (isBlocked) {
    fail(400, "Access to this directory is not allowed");
  }

  if (!existsSync(normalized)) {
    return [];
  }

  const stat = statSync(normalized);
  if (!stat.isDirectory()) {
    return [];
  }

  try {
    const entries = readdirSync(normalized, { withFileTypes: true });
    const folders = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => normalized + "/" + entry.name)
      .sort();

    return folders;
  } catch {
    return [];
  }
};
