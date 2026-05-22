// Tiny client wrapper around the SvelteKit proxies under
// /books/[id]/shelves and /_internal/shelves. Centralized so the chip row
// and the picker stay in sync.

export type Shelf = { id: string; name: string; bookCount?: number };

export async function persistBookShelves(bookId: string, shelfIds: string[]) {
  const res = await fetch(`/books/${bookId}/shelves`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ shelfIds }),
  });
  if (!res.ok) throw new Error(`assign failed (${res.status})`);
}

export async function fetchBookShelves(bookId: string): Promise<string[]> {
  const res = await fetch(`/books/${bookId}/shelves`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`load failed (${res.status})`);
  const data = (await res.json()) as { shelfIds: string[] };
  return data.shelfIds;
}

export async function fetchAllShelves(): Promise<Shelf[]> {
  const res = await fetch("/_internal/shelves", { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`shelves load failed (${res.status})`);
  return (await res.json()) as Shelf[];
}

export async function createShelf(name: string): Promise<Shelf> {
  const res = await fetch("/_internal/shelves", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(`create failed (${res.status})`);
  return (await res.json()) as Shelf;
}
