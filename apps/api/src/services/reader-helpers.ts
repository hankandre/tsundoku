import * as path from "node:path";
import { unzipSync, strFromU8 } from "fflate";
import { XMLParser } from "fast-xml-parser";
import { PDFDocument } from "pdf-lib";
import { resolveBookFile } from "./files.ts";
import { logger } from "../logger.ts";

// Shared XML parser config matching extractors/epub.ts.
const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
});

const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);
const IMAGE_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

/** PDF: load the doc trailer and return page count. Cheap-ish. */
export async function pdfPageCount(bookId: string): Promise<number | null> {
  const resolved = await resolveBookFile(bookId);
  if (!resolved) return null;
  try {
    const bytes = new Uint8Array(await Bun.file(resolved.absolutePath).arrayBuffer());
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    return doc.getPageCount();
  } catch (e) {
    logger.warn({ err: e, bookId }, "pdfPageCount failed");
    return null;
  }
}

/**
 * PDF TOC — pdf-lib doesn't expose outline parsing directly, so this is a
 * stub returning an empty list. A real impl uses pdfjs-dist's outline API.
 */
export async function pdfToc(_bookId: string): Promise<Array<{ title: string; page: number }>> {
  return [];
}

/** EPUB TOC parsed from the OPF spine + nav doc. Mirrors the cover lookup. */
export async function epubManifest(bookId: string): Promise<{
  title: string | null;
  toc: Array<{ label: string; href: string }>;
  spine: string[];
} | null> {
  const resolved = await resolveBookFile(bookId);
  if (!resolved) return null;
  let zip: Record<string, Uint8Array>;
  try {
    const buf = new Uint8Array(await Bun.file(resolved.absolutePath).arrayBuffer());
    zip = unzipSync(buf);
  } catch (e) {
    logger.warn({ err: e, bookId }, "epubManifest unzip failed");
    return null;
  }
  const container = zip["META-INF/container.xml"];
  if (!container) return null;
  const cdoc = xml.parse(strFromU8(container));
  const rootfile = cdoc?.container?.rootfiles?.rootfile;
  const opfPath: string | undefined = Array.isArray(rootfile)
    ? rootfile[0]?.["@_full-path"]
    : rootfile?.["@_full-path"];
  if (!opfPath) return null;
  const opfBuf = zip[opfPath];
  if (!opfBuf) return null;
  const pkg = xml.parse(strFromU8(opfBuf))?.package;
  if (!pkg) return null;

  const md = pkg.metadata ?? {};
  const titleNode = md.title;
  const title =
    typeof titleNode === "string"
      ? titleNode
      : Array.isArray(titleNode)
        ? typeof titleNode[0] === "string"
          ? titleNode[0]
          : titleNode[0]?.["#text"] ?? null
        : titleNode?.["#text"] ?? null;

  // Spine: ordered list of idrefs into manifest.
  const manifest = Array.isArray(pkg.manifest?.item) ? pkg.manifest.item : [pkg.manifest?.item];
  const byId = new Map<string, string>();
  for (const it of manifest) {
    if (!it) continue;
    const id = it["@_id"];
    const href = it["@_href"];
    if (id && href) byId.set(id, href);
  }
  const spineItems = Array.isArray(pkg.spine?.itemref) ? pkg.spine.itemref : [pkg.spine?.itemref];
  const opfDir = path.posix.dirname(opfPath);
  const spine = spineItems
    .filter(Boolean)
    .map((s: { "@_idref"?: string }) => s["@_idref"])
    .map((id: string | undefined) => (id ? byId.get(id) : undefined))
    .filter((h: string | undefined): h is string => !!h)
    .map((h: string) => path.posix.join(opfDir, h));

  // TOC: prefer EPUB 3 nav doc (manifest item with properties=nav), fall
  // back to NCX (toc attribute on spine).
  const navItem = manifest.find(
    (i: { "@_properties"?: string }) => (i?.["@_properties"] ?? "").includes("nav"),
  );
  const toc: Array<{ label: string; href: string }> = [];
  if (navItem?.["@_href"]) {
    const navPath = path.posix.join(opfDir, navItem["@_href"]);
    const navHtml = zip[navPath];
    if (navHtml) {
      const html = strFromU8(navHtml);
      // Crude extraction — <a href="...">label</a> inside <nav epub:type="toc">.
      const navMatch = html.match(/<nav[^>]*epub:type=["']toc["'][^>]*>([\s\S]*?)<\/nav>/i);
      const body = navMatch?.[1] ?? html;
      const linkRe = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
      let m;
      while ((m = linkRe.exec(body))) {
        toc.push({
          label: m[2]!.replace(/<[^>]+>/g, "").trim(),
          href: path.posix.join(opfDir, m[1]!),
        });
      }
    }
  }
  return { title, toc, spine };
}

/** CBX page list: sort image entries by filename. */
export async function cbxPages(bookId: string): Promise<string[] | null> {
  const resolved = await resolveBookFile(bookId);
  if (!resolved) return null;
  try {
    const buf = new Uint8Array(await Bun.file(resolved.absolutePath).arrayBuffer());
    const zip = unzipSync(buf);
    return Object.keys(zip)
      .filter((n) => IMAGE_EXTS.has(path.extname(n).toLowerCase()))
      .sort();
  } catch (e) {
    logger.warn({ err: e, bookId }, "cbxPages unzip failed");
    return null;
  }
}

/** Stream a single CBX page image as a Response. */
export async function cbxPage(bookId: string, index: number): Promise<Response | null> {
  const pages = await cbxPages(bookId);
  if (!pages || index < 0 || index >= pages.length) return null;
  const resolved = await resolveBookFile(bookId);
  if (!resolved) return null;
  const buf = new Uint8Array(await Bun.file(resolved.absolutePath).arrayBuffer());
  const zip = unzipSync(buf);
  const name = pages[index]!;
  const bytes = zip[name];
  if (!bytes) return null;
  const ext = path.extname(name).toLowerCase();
  return new Response(bytes, {
    headers: {
      "Content-Type": IMAGE_MIME[ext] ?? "application/octet-stream",
      "Cache-Control": "private, max-age=86400",
    },
  });
}
