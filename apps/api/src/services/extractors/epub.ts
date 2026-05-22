import { unzipSync, strFromU8 } from "fflate";
import { XMLParser } from "fast-xml-parser";
import * as path from "node:path";
import type { ExtractorResult } from "./types.ts";

// EPUB extractor structure: load the zip → locate the OPF rootfile via
// META-INF/container.xml → parse the OPF → extract metadata + cover. Each
// step is its own function so the orchestration reads top-to-bottom.

type Zip = Record<string, Uint8Array>;

const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true, // strips dc:, opf: etc — we just see "title", "creator"
  parseTagValue: false,
  parseAttributeValue: false,
});

const COVER_MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

/**
 * fast-xml-parser returns repeated elements as arrays, single elements as
 * objects with `#text`, and leaf strings as plain strings. We normalize all
 * three into "first non-empty string" / "list of non-empty strings".
 */
const asArray = <T>(v: T | T[] | undefined | null): T[] =>
  v == null ? [] : Array.isArray(v) ? v : [v];

function asText(node: unknown): string | null {
  if (node == null) return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const t = asText(item);
      if (t) return t;
    }
    return null;
  }
  if (typeof node === "string") return node.trim() || null;
  if (typeof node === "object" && "#text" in (node as Record<string, unknown>)) {
    return String((node as Record<string, string>)["#text"]).trim() || null;
  }
  return null;
}

const asTexts = (node: unknown): string[] =>
  asArray(node)
    .map(asText)
    .filter((v): v is string => !!v);

async function loadZip(absPath: string): Promise<Zip> {
  const buf = new Uint8Array(await Bun.file(absPath).arrayBuffer());
  return unzipSync(buf);
}

/** Resolve the OPF rootfile location via META-INF/container.xml. */
function readOpf(zip: Zip): { opfDir: string; pkg: Record<string, unknown> } | null {
  const containerBuf = zip["META-INF/container.xml"];
  if (!containerBuf) return null;
  const container = xml.parse(strFromU8(containerBuf));
  const rootfile = asArray(container?.container?.rootfiles?.rootfile)[0];
  const opfPath = (rootfile?.["@_full-path"] as string | undefined) ?? null;
  if (!opfPath) return null;
  const opfBuf = zip[opfPath];
  if (!opfBuf) return null;
  const pkg = xml.parse(strFromU8(opfBuf))?.package;
  if (!pkg || typeof pkg !== "object") return null;
  return { opfDir: path.posix.dirname(opfPath), pkg };
}

function parseIsbns(identifiers: unknown): { isbn10: string | null; isbn13: string | null } {
  const items = asArray(identifiers).map((id) => {
    const obj = id as Record<string, unknown>;
    const scheme = String(obj?.["@_scheme"] ?? "").toLowerCase();
    const value = asText(id) ?? "";
    return { scheme, value };
  });
  // Either an explicit ISBN scheme or a urn:isbn: prefixed identifier value.
  const raw =
    items.find((i) => i.scheme.includes("isbn"))?.value ??
    items.find((i) => /urn:isbn:/i.test(i.value))?.value ??
    "";
  const digits = raw.replace(/[^0-9X]/gi, "");
  return {
    isbn10: digits.length === 10 ? digits : null,
    isbn13: digits.length === 13 ? digits : null,
  };
}

/** Locate the cover image href inside the manifest, handling EPUB 2 + 3. */
function findCoverHref(pkg: Record<string, unknown>): string | null {
  const manifest = (pkg["manifest"] ?? {}) as Record<string, unknown>;
  const items = asArray(manifest["item"]) as Array<Record<string, string>>;
  // EPUB 3: properties="cover-image" on a manifest item.
  const epub3 = items.find((i) => (i["@_properties"] ?? "").includes("cover-image"));
  if (epub3?.["@_href"]) return epub3["@_href"];
  // EPUB 2: <meta name="cover" content="manifest-item-id"/>.
  const metadata = (pkg["metadata"] ?? {}) as Record<string, unknown>;
  const coverMeta = asArray(metadata["meta"]).find(
    (m) => typeof m === "object" && m && (m as Record<string, string>)["@_name"] === "cover",
  ) as Record<string, string> | undefined;
  const coverId = coverMeta?.["@_content"];
  if (!coverId) return null;
  return items.find((i) => i["@_id"] === coverId)?.["@_href"] ?? null;
}

function readCover(
  zip: Zip,
  pkg: Record<string, unknown>,
  opfDir: string,
): ExtractorResult["cover"] {
  const href = findCoverHref(pkg);
  if (!href) return null;
  const coverPath = path.posix.join(opfDir, href);
  const bytes = zip[coverPath];
  if (!bytes) return null;
  const ext = path.extname(href).toLowerCase();
  return {
    bytes,
    contentType: COVER_MIME_BY_EXT[ext] ?? "application/octet-stream",
  };
}

function findMetaAttr(meta: unknown, name: string): string | null {
  for (const m of asArray(meta) as Array<Record<string, unknown>>) {
    if ((m["@_name"] as string | undefined) === name) {
      const c = m["@_content"];
      if (typeof c === "string") return c;
    }
    // EPUB 3: <meta property="...">value</meta>
    if ((m["@_property"] as string | undefined) === name) {
      const t = asText(m);
      if (t) return t;
    }
  }
  return null;
}

function readMetadata(md: Record<string, unknown>) {
  const titles = asTexts(md["title"]);
  const { isbn10, isbn13 } = parseIsbns(md["identifier"]);
  // Calibre stores series under <meta name="calibre:series" content="..."/>
  // EPUB 3 uses <meta property="belongs-to-collection">.
  const seriesName =
    findMetaAttr(md["meta"], "calibre:series") ??
    findMetaAttr(md["meta"], "belongs-to-collection");
  const seriesIndexStr =
    findMetaAttr(md["meta"], "calibre:series_index") ??
    findMetaAttr(md["meta"], "group-position");
  const seriesNumber =
    seriesIndexStr && !Number.isNaN(Number(seriesIndexStr))
      ? Number(seriesIndexStr)
      : null;
  return {
    title: titles[0] ?? null,
    subtitle: titles[1] ?? null,
    authors: asTexts(md["creator"]),
    description: asText(md["description"]),
    publisher: asText(md["publisher"]),
    publishedDate: asText(md["date"]),
    language: asText(md["language"]),
    categories: asTexts(md["subject"]),
    seriesName,
    seriesNumber,
    isbn10,
    isbn13,
  };
}

export async function extractEpub(absPath: string): Promise<ExtractorResult> {
  let zip: Zip;
  try {
    zip = await loadZip(absPath);
  } catch (e) {
    return { warning: `Unzip failed: ${e instanceof Error ? e.message : String(e)}` };
  }

  const opf = readOpf(zip);
  if (!opf) return { warning: "OPF rootfile not found" };
  const metadata = (opf.pkg["metadata"] ?? {}) as Record<string, unknown>;

  return {
    ...readMetadata(metadata),
    cover: readCover(zip, opf.pkg, opf.opfDir),
  };
}
