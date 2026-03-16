import path from "path";
import { strFromU8, unzipSync } from "fflate";

export interface EpubMetadata {
  title: string | null;
  subtitle: string | null;
  authors: string[];
  language: string | null;
  publisher: string | null;
  publishedDate: string | null;
  isbn10: string | null;
  isbn13: string | null;
}

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, " ").trim();

const decodeXmlEntities = (value: string): string =>
  value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");

const readTextTag = (xml: string, tagName: string): string | null => {
  const expression = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, "i");
  const match = xml.match(expression);
  if (!match || !match[1]) {
    return null;
  }

  return normalizeWhitespace(decodeXmlEntities(match[1]));
};

const readTextTags = (xml: string, tagName: string): string[] => {
  const expression = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, "gi");
  const values: string[] = [];

  for (const match of xml.matchAll(expression)) {
    const value = match[1];
    if (!value) {
      continue;
    }

    const normalized = normalizeWhitespace(decodeXmlEntities(value));
    if (normalized.length > 0) {
      values.push(normalized);
    }
  }

  return values;
};

const normalizeIsbn = (candidate: string): { isbn10: string | null; isbn13: string | null } => {
  const cleaned = candidate.replaceAll(/[^0-9Xx]/g, "").toUpperCase();
  if (cleaned.length === 10) {
    return { isbn10: cleaned, isbn13: null };
  }

  if (cleaned.length === 13) {
    return { isbn10: null, isbn13: cleaned };
  }

  return { isbn10: null, isbn13: null };
};

const readIsbnIdentifiers = (opfXml: string): { isbn10: string | null; isbn13: string | null } => {
  const identifierValues = readTextTags(opfXml, "dc:identifier");
  for (const identifierValue of identifierValues) {
    const identifier = normalizeIsbn(identifierValue);
    if (identifier.isbn10 || identifier.isbn13) {
      return identifier;
    }
  }

  return { isbn10: null, isbn13: null };
};

const resolveOpfPath = (containerXml: string): string | null => {
  const match = containerXml.match(/full-path\s*=\s*"([^"]+)"/i);
  if (!match || !match[1]) {
    return null;
  }

  return match[1];
};

const selectEntry = (archiveEntries: Record<string, Uint8Array>, desiredPath: string): Uint8Array | null => {
  const direct = archiveEntries[desiredPath];
  if (direct) {
    return direct;
  }

  const normalizedDesiredPath = desiredPath.replaceAll("\\", "/").toLowerCase();
  for (const [entryPath, entryBytes] of Object.entries(archiveEntries)) {
    if (entryPath.toLowerCase() === normalizedDesiredPath) {
      return entryBytes;
    }
  }

  return null;
};

export const extractEpubMetadata = async (epubPath: string): Promise<EpubMetadata> => {
  const fallbackTitle = path.basename(epubPath, path.extname(epubPath));

  const archiveBuffer = await Bun.file(epubPath).arrayBuffer();
  const archiveEntries = unzipSync(new Uint8Array(archiveBuffer));

  const containerBytes = selectEntry(archiveEntries, "META-INF/container.xml");
  if (!containerBytes) {
    return {
      title: fallbackTitle,
      subtitle: null,
      authors: [],
      language: null,
      publisher: null,
      publishedDate: null,
      isbn10: null,
      isbn13: null,
    };
  }

  const containerXml = strFromU8(containerBytes);
  const opfPath = resolveOpfPath(containerXml);
  if (!opfPath) {
    return {
      title: fallbackTitle,
      subtitle: null,
      authors: [],
      language: null,
      publisher: null,
      publishedDate: null,
      isbn10: null,
      isbn13: null,
    };
  }

  const opfBytes = selectEntry(archiveEntries, opfPath);
  if (!opfBytes) {
    return {
      title: fallbackTitle,
      subtitle: null,
      authors: [],
      language: null,
      publisher: null,
      publishedDate: null,
      isbn10: null,
      isbn13: null,
    };
  }

  const opfXml = strFromU8(opfBytes);
  const title = readTextTag(opfXml, "dc:title") ?? fallbackTitle;
  const subtitle = readTextTag(opfXml, "subtitle");
  const authors = readTextTags(opfXml, "dc:creator");
  const language = readTextTag(opfXml, "dc:language");
  const publisher = readTextTag(opfXml, "dc:publisher");
  const publishedDate = readTextTag(opfXml, "dc:date");
  const { isbn10, isbn13 } = readIsbnIdentifiers(opfXml);

  return {
    title,
    subtitle,
    authors,
    language,
    publisher,
    publishedDate,
    isbn10,
    isbn13,
  };
};
