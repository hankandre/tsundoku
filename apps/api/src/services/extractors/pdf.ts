import { PDFDocument } from "pdf-lib";
import type { ExtractorResult } from "./types.ts";

/**
 * Extract metadata from a PDF using pdf-lib. Pure-JS, no native deps, but
 * limited to the PDF info dictionary — no XMP, no cover render. Booklore's
 * Java PDFBox path is richer; covers and XMP are deferred to a follow-up.
 */
export async function extractPdf(absPath: string): Promise<ExtractorResult> {
  const bytes = await Bun.file(absPath).arrayBuffer();
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes, { updateMetadata: false });
  } catch (e) {
    return { warning: `pdf-lib failed: ${e instanceof Error ? e.message : String(e)}` };
  }

  const title = doc.getTitle()?.trim() || null;
  const author = doc.getAuthor()?.trim() || null;
  const subject = doc.getSubject()?.trim() || null;
  const creationDate = doc.getCreationDate();
  const pageCount = doc.getPageCount();

  // The Author field is sometimes "Last, First" or "First Last; Second Author";
  // split on common separators.
  const authors = author
    ? author
        .split(/[,;&]| and /i)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  return {
    title,
    description: subject,
    authors,
    pageCount,
    publishedDate: creationDate ? creationDate.toISOString().slice(0, 10) : null,
    cover: null, // No render in pdf-lib; intentional.
  };
}
