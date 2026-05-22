import type { Actions, PageServerLoad } from "./$types";
import { error, fail, redirect } from "@sveltejs/kit";
import { requireLogin } from "$lib/server/session";

export const load: PageServerLoad = async ({ params, locals, cookies, fetch, url }) => {
  requireLogin(locals, url.pathname);
  const id = params.id;
  if (!id) throw error(400, "Bad book id");

  const { rpc } = locals;
  const res = await rpc.api.v1.books[":id"].$get({ param: { id } });
  if (res.status === 404) throw error(404, "Book not found");
  if (!res.ok) throw error(res.status, "Failed to load book");
  const book = await res.json();
  return { book };
};

function nullableString(v: FormDataEntryValue | null): string | null | undefined {
  if (v === null) return undefined;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function nullableInt(v: FormDataEntryValue | null): number | null | undefined {
  if (v === null) return undefined;
  const s = String(v).trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export const actions: Actions = {
  default: async ({ request, params, fetch, cookies, locals, url }) => {
    requireLogin(locals, url.pathname);
    const id = params.id;
    if (!id) return fail(400, { error: "Bad id" });
    const form = await request.formData();

    const payload: Record<string, unknown> = {};
    const fields = [
      "title",
      "subtitle",
      "description",
      "publisher",
      "publishedDate",
      "isbn10",
      "isbn13",
      "asin",
      "language",
      "ageRating",
      "seriesName",
    ] as const;
    for (const f of fields) {
      const v = nullableString(form.get(f));
      if (v !== undefined) payload[f] = v;
    }
    const pageCount = nullableInt(form.get("pageCount"));
    if (pageCount !== undefined) payload["pageCount"] = pageCount;
    const seriesNumberRaw = form.get("seriesNumber");
    if (seriesNumberRaw !== null) {
      const s = String(seriesNumberRaw).trim();
      payload["seriesNumber"] = s === "" ? null : Number(s);
    }
    const ratingRaw = form.get("rating");
    if (ratingRaw !== null) {
      const s = String(ratingRaw).trim();
      payload["rating"] = s === "" ? null : Number(s);
    }
    const authorsRaw = String(form.get("authors") ?? "").trim();
    if (authorsRaw) {
      payload["authors"] = authorsRaw.split(",").map((a) => a.trim()).filter(Boolean);
    }
    const categoriesRaw = String(form.get("categories") ?? "").trim();
    if (categoriesRaw) {
      payload["categories"] = categoriesRaw.split(",").map((c) => c.trim()).filter(Boolean);
    }
    // Locks
    for (const lock of ["titleLocked", "descriptionLocked", "authorsLocked"] as const) {
      payload[lock] = form.get(lock) === "on";
    }

    const { rpc } = locals;
    const res = await rpc.api.v1.books[":id"].metadata.$put({
      param: { id },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      json: payload as any,
    });
    if (!res.ok) return fail(res.status, { error: "Update failed" });
    throw redirect(303, `/books/${id}`);
  },
};
