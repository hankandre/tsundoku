import { env } from "../config/env";

export type VersionInfo = {
  current: string;
  latest: string;
};

export type ReleaseNote = {
  version: string;
  name: string;
  changelog: string;
  url: string;
  publishedAt: string;
};

const GITHUB_RELEASES_URL = "https://api.github.com/repos/booklore-app/booklore/releases";
const GITHUB_LATEST_URL = "https://api.github.com/repos/booklore-app/booklore/releases/latest";

const fetchJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "BookLore-Version-Checker",
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API request failed (${response.status})`);
  }

  return (await response.json()) as T;
};

const normalizeVersion = (raw: string): number[] =>
  raw
    .replace(/^v/i, "")
    .split(".")
    .map((part) => Number.parseInt(part, 10))
    .map((part) => (Number.isFinite(part) ? part : 0));

const isVersionGreater = (left: string, right: string): boolean => {
  const v1 = normalizeVersion(left);
  const v2 = normalizeVersion(right);
  const size = Math.max(v1.length, v2.length);

  for (let index = 0; index < size; index += 1) {
    const l = v1[index] ?? 0;
    const r = v2[index] ?? 0;
    if (l > r) {
      return true;
    }
    if (l < r) {
      return false;
    }
  }

  return false;
};

type GitHubRelease = {
  tag_name?: string;
  name?: string;
  body?: string;
  published_at?: string;
};

export const getVersionInfo = async (): Promise<VersionInfo> => {
  try {
    const payload = await fetchJson<GitHubRelease>(GITHUB_LATEST_URL);
    return {
      current: env.appVersion,
      latest: payload.tag_name ?? "unknown",
    };
  } catch {
    return {
      current: env.appVersion,
      latest: "unknown",
    };
  }
};

export const getChangelogSinceCurrent = async (): Promise<ReleaseNote[]> => {
  if (env.appVersion === "development") {
    return [];
  }

  try {
    const releases = await fetchJson<GitHubRelease[]>(`${GITHUB_RELEASES_URL}?per_page=15`);
    return releases
      .filter((release) => release.tag_name && isVersionGreater(release.tag_name, env.appVersion))
      .map((release) => ({
        version: release.tag_name ?? "unknown",
        name: release.name ?? release.tag_name ?? "unknown",
        changelog: release.body ?? "",
        url: `https://github.com/booklore-app/booklore/releases/tag/${release.tag_name ?? "unknown"}`,
        publishedAt: release.published_at ?? new Date().toISOString(),
      }));
  } catch {
    return [];
  }
};
