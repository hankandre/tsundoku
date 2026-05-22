import { XMLParser } from "fast-xml-parser";
import type { ExtractorResult } from "./types.ts";

const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  parseTagValue: false,
});

function joinName(n: { "first-name"?: string; "middle-name"?: string; "last-name"?: string }) {
  return [n["first-name"], n["middle-name"], n["last-name"]]
    .filter((s): s is string => !!s)
    .join(" ")
    .trim();
}

/**
 * FB2 is just an XML file. The schema's titleInfo holds book metadata and the
 * book may embed binary base64 covers via <binary id="cover.jpg" content-type=…>.
 */
export async function extractFb2(absPath: string): Promise<ExtractorResult> {
  let text: string;
  try {
    text = await Bun.file(absPath).text();
  } catch (e) {
    return { warning: `Read failed: ${e instanceof Error ? e.message : String(e)}` };
  }
  const doc = xml.parse(text)?.["FictionBook"];
  if (!doc) return { warning: "Not a valid FictionBook" };

  const desc = doc.description ?? {};
  const ti = desc["title-info"] ?? {};
  const pi = desc["publish-info"] ?? {};

  const authorNodes = Array.isArray(ti.author) ? ti.author : ti.author ? [ti.author] : [];
  const authors = authorNodes.map(joinName).filter((s: string) => s.length > 0);

  const title = ti["book-title"] ?? null;
  const description =
    typeof ti.annotation === "string"
      ? ti.annotation
      : typeof ti.annotation?.["#text"] === "string"
        ? ti.annotation["#text"]
        : null;
  const language = ti.lang ?? null;
  const publisher = pi.publisher ?? null;
  const publishedDate = pi.year ?? null;

  let cover: ExtractorResult["cover"] = null;
  const coverId = ti.coverpage?.image?.["@_href"]?.replace(/^#/, "");
  if (coverId) {
    const binaries = Array.isArray(doc.binary) ? doc.binary : doc.binary ? [doc.binary] : [];
    const bin = binaries.find(
      (b: Record<string, string>) => b["@_id"] === coverId,
    ) as Record<string, string> | undefined;
    if (bin?.["#text"]) {
      const bytes = Uint8Array.from(atob(bin["#text"].trim()), (c) => c.charCodeAt(0));
      cover = { bytes, contentType: bin["@_content-type"] ?? "image/jpeg" };
    }
  }

  return { title, authors, description, language, publisher, publishedDate, cover };
}
