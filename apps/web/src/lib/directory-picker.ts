export type DirectoryEntry = {
  name: string;
  isDir: boolean;
  isMount: boolean;
};

export type DirectoryListResponse = {
  path: string;
  parent: string | null;
  root: string;
  writable: boolean;
  entries: DirectoryEntry[];
};

export type Breadcrumb = {
  name: string;
  path: string;
};

export function buildDirectoryListUrl(input: {
  origin: string;
  path: string;
  showHidden: boolean;
}): URL {
  const url = new URL("/_internal/fs/list", input.origin);
  url.searchParams.set("path", input.path);
  if (input.showHidden) url.searchParams.set("showHidden", "true");
  return url;
}

export function childPath(current: string, childName: string): string {
  if (current === "/") return `/${childName}`;
  return `${current}/${childName}`;
}

export function breadcrumbs(path: string): Breadcrumb[] {
  if (path === "/") return [{ name: "/", path: "/" }];

  const crumbs: Breadcrumb[] = [{ name: "/", path: "/" }];
  let current = "";
  for (const part of path.split("/").filter(Boolean)) {
    current += `/${part}`;
    crumbs.push({ name: part, path: current });
  }
  return crumbs;
}
