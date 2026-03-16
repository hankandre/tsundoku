import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const controllerDir = join(process.cwd(), "..", "booklore-api", "src", "main", "java", "org", "booklore", "controller");
const outputDir = join(process.cwd(), "docs", "contracts");
const outputFile = join(outputDir, "endpoint-inventory.md");

type Endpoint = {
  controller: string;
  method: string;
  path: string;
};

const httpMappings: Record<string, string> = {
  GetMapping: "GET",
  PostMapping: "POST",
  PutMapping: "PUT",
  PatchMapping: "PATCH",
  DeleteMapping: "DELETE",
  RequestMapping: "ANY",
};

const parseValue = (raw: string | undefined): string => {
  if (!raw) {
    return "";
  }

  const cleaned = raw.trim();
  if (cleaned.startsWith("\"") && cleaned.endsWith("\"")) {
    return cleaned.slice(1, -1);
  }

  const valueMatch = cleaned.match(/value\s*=\s*"([^"]+)"/);
  if (valueMatch?.[1]) {
    return valueMatch[1];
  }

  return "";
};

const normalizePath = (base: string, child: string): string => {
  const segments = [base, child]
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => part.replace(/^\/+|\/+$/g, ""));

  return `/${segments.join("/")}`.replace(/\/+/g, "/");
};

const extractEndpoints = (controller: string, source: string): Endpoint[] => {
  const baseMatch = source.match(/@RequestMapping(?:\(([^)]*)\))?/);
  const basePath = parseValue(baseMatch?.[1]);

  const endpoints: Endpoint[] = [];
  const regex = /@(GetMapping|PostMapping|PutMapping|PatchMapping|DeleteMapping|RequestMapping)(?:\(([^)]*)\))?/g;

  let match: RegExpExecArray | null = regex.exec(source);
  while (match) {
    const mapping = match[1];
    const annotationPayload = match[2];
    const childPath = parseValue(annotationPayload);

    endpoints.push({
      controller,
      method: httpMappings[mapping] ?? "ANY",
      path: normalizePath(basePath, childPath),
    });

    match = regex.exec(source);
  }

  return endpoints;
};

const run = async () => {
  const files = await readdir(controllerDir);
  const javaFiles = files.filter((file) => file.endsWith("Controller.java"));

  const endpoints: Endpoint[] = [];

  for (const file of javaFiles) {
    const fullPath = join(controllerDir, file);
    const source = await readFile(fullPath, "utf-8");
    endpoints.push(...extractEndpoints(file, source));
  }

  endpoints.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));

  const lines = [
    "# Endpoint Inventory (Generated)",
    "",
    `Generated at: ${new Date().toISOString()}`,
    "",
    "| Method | Path | Controller |",
    "| --- | --- | --- |",
    ...endpoints.map((endpoint) => `| ${endpoint.method} | \`${endpoint.path}\` | ${endpoint.controller} |`),
    "",
    `Total endpoints: ${endpoints.length}`,
  ];

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputFile, `${lines.join("\n")}\n`, "utf-8");
  console.log(`Wrote ${outputFile} with ${endpoints.length} endpoints`);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
