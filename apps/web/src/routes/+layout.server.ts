import type { LayoutServerLoad } from "./$types";

type SidebarLibrary = { id: number | string; name: string; count?: number };
type SidebarShelf = { id: number | string; name: string; count?: number };

export const load: LayoutServerLoad = async ({ locals, cookies, fetch }) => {
  const user = locals.user;

  let libraries: SidebarLibrary[] = [];
  let shelves: SidebarShelf[] = [];
  let magicShelves: SidebarShelf[] = [];

  if (user) {
    const { rpc } = locals;
    const results = await Promise.allSettled([
      rpc.api.v1.libraries.$get(),
      rpc.api.v1.shelves.$get(),
      rpc.api.v1["magic-shelves"].$get(),
    ]);

    if (results[0].status === "fulfilled" && results[0].value.ok) {
      const raw = (await results[0].value.json()) as Array<{
        id: number | string;
        name: string;
        bookCount?: number;
      }>;
      libraries = raw.map((l) => ({ id: l.id, name: l.name, count: l.bookCount }));
    }
    if (results[1].status === "fulfilled" && results[1].value.ok) {
      const raw = (await results[1].value.json()) as Array<{
        id: number | string;
        name: string;
        bookCount?: number;
      }>;
      shelves = raw.map((s) => ({ id: s.id, name: s.name, count: s.bookCount }));
    }
    if (results[2].status === "fulfilled" && results[2].value.ok) {
      const raw = (await results[2].value.json()) as Array<{
        id: number | string;
        name: string;
        bookCount?: number;
      }>;
      magicShelves = raw.map((s) => ({ id: s.id, name: s.name, count: s.bookCount }));
    }
  }

  return { user, sidebar: { libraries, shelves, magicShelves } };
};
