<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import Filter from "@lucide/svelte/icons/funnel";
  import ArrowUpDown from "@lucide/svelte/icons/arrow-up-down";
  import type { PageData } from "./$types";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Button } from "$lib/components/ui/button";
  import * as Select from "$lib/components/ui/select";
  import LibrarySection from "$lib/components/library/library-section.svelte";
  import BookListRow from "$lib/components/library/book-list-row.svelte";
  import BookCard from "$lib/components/library/book-card.svelte";
  import InfiniteList from "$lib/components/library/infinite-list.svelte";
  import DensityToggle, {
    type Density,
  } from "$lib/components/library/density-toggle.svelte";

  let { data }: { data: PageData } = $props();

  type Book = (typeof data.books.content)[number];

  // Filter form is seeded from data.filter on each navigation. SvelteKit
  // creates a new component instance on form submission, so $state(...) captures
  // fresh URL-driven values. The Select primitives below bind to these and
  // submit via hidden inputs (bits-ui renders custom HTML, not a real <select>).
  let searchValue = $state(data.filter.search);
  let bookType = $state(data.filter.bookType);
  let sortValue = $state(data.filter.sort);

  const formatLabels: Record<string, string> = {
    "": "All",
    PDF: "PDF",
    EPUB: "EPUB",
    CBX: "CBZ",
    MOBI: "MOBI",
    AZW3: "AZW3",
    FB2: "FB2",
    AUDIOBOOK: "Audiobook",
  };
  const sortLabels: Record<string, string> = {
    addedOn: "Added",
    title: "Title",
    rating: "Rating",
    pageCount: "Pages",
  };

  // Density: persisted to localStorage so a librarian-mode preference survives
  // navigation. Mount-only read; SSR renders the default to avoid hydration churn.
  let density = $state<Density>("grid");
  onMount(() => {
    try {
      const stored = localStorage.getItem("tsundoku-density");
      if (stored === "grid" || stored === "list") density = stored;
    } catch {
      // ignore
    }
  });
  $effect(() => {
    try {
      localStorage.setItem("tsundoku-density", density);
    } catch {
      // ignore
    }
  });

  // Accumulated books across paged fetches. The +page.server.ts loader fills
  // the first page; the InfiniteList triggers subsequent pages via /books
  // +server.ts. When filters change, SvelteKit re-runs the loader and the
  // component remounts, so this state re-initializes from the fresh page.
  let items = $state<Book[]>([...data.books.content]);
  const total = $derived(data.books.totalElements);
  let nextPage = $state(1); // page 0 already loaded by the server loader
  let isLoading = $state(false);

  async function loadMore() {
    if (isLoading) return;
    if (items.length >= total) return;
    isLoading = true;
    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        size: String(data.books.size),
      });
      for (const [k, v] of Object.entries(data.filter)) {
        if (v) params.set(k, v);
      }
      const res = await fetch(`/books?${params.toString()}`, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`books page fetch failed: ${res.status}`);
      const body = (await res.json()) as typeof data.books;
      // Append uniquely (defensive; same id shouldn't repeat across pages).
      const seen = new Set(items.map((b) => b.id));
      for (const b of body.content) {
        if (!seen.has(b.id)) items.push(b);
      }
      nextPage += 1;
    } finally {
      isLoading = false;
    }
  }

  // Libraries come from the layout (sidebar data). When no libraryId filter is
  // active, books get grouped under their parent library; otherwise one flat
  // section is rendered.
  const sidebarLibraries = $derived(
    (page.data?.sidebar?.libraries ?? []) as { id: number | string; name: string }[],
  );

  const grouped = $derived.by(() => {
    if (data.filter.libraryId) return null;
    const libById = new Map<string, { id: number | string; name: string; books: Book[] }>();
    for (const lib of sidebarLibraries) {
      libById.set(String(lib.id), { id: lib.id, name: lib.name, books: [] });
    }
    const orphans: Book[] = [];
    for (const b of items as Array<Book & { libraryId?: string }>) {
      const key = b.libraryId != null ? String(b.libraryId) : null;
      if (key && libById.has(key)) libById.get(key)!.books.push(b);
      else orphans.push(b);
    }
    const groups = Array.from(libById.values()).filter((g) => g.books.length > 0);
    return { groups, orphans };
  });

  const activeFilters = $derived.by(() => {
    const out: { key: string; label: string }[] = [];
    if (data.filter.search) out.push({ key: "search", label: `“${data.filter.search}”` });
    if (data.filter.bookType) out.push({ key: "bookType", label: data.filter.bookType });
    if (data.filter.libraryId) {
      const lib = sidebarLibraries.find((l) => String(l.id) === data.filter.libraryId);
      out.push({ key: "libraryId", label: lib?.name ?? "Library" });
    }
    return out;
  });
</script>

<section class="space-y-8">
  <!-- Skip-to-results landmark for screen readers + keyboard users with filters active -->
  {#if activeFilters.length > 0}
    <a
      href="#results"
      class="absolute left-2 top-2 -translate-y-16 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-transform focus-visible:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      Skip to results
    </a>
  {/if}

  <header class="flex flex-col gap-1">
    <span class="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
      Browse
    </span>
    <div class="flex items-baseline justify-between gap-4">
      <h1 class="font-display text-4xl tracking-tight">All books</h1>
      <span class="font-mono text-xs tabular-nums text-muted-foreground">
        {total.toLocaleString()} in the pile
      </span>
    </div>
  </header>

  <form method="GET" class="space-y-4">
    <div class="flex flex-wrap items-end gap-3">
      <div class="min-w-0 flex-1 space-y-1.5">
        <Label for="search" class="text-xs font-medium text-muted-foreground">
          <span class="inline-flex items-center gap-1.5">
            <Filter size={11} /> Search
          </span>
        </Label>
        <Input
          id="search"
          name="search"
          type="text"
          bind:value={searchValue}
          placeholder="Title, author, ISBN…"
          class="h-9"
        />
      </div>
      <div class="space-y-1.5">
        <Label for="bookType-trigger" class="text-xs font-medium text-muted-foreground">
          Format
        </Label>
        <Select.Root type="single" bind:value={bookType}>
          <Select.Trigger id="bookType-trigger" class="h-9 w-36">
            {formatLabels[bookType] ?? "All"}
          </Select.Trigger>
          <Select.Content>
            {#each Object.entries(formatLabels) as [value, label] (value)}
              <Select.Item {value} {label}>{label}</Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
        <input type="hidden" name="bookType" value={bookType} />
      </div>
      <div class="space-y-1.5">
        <Label for="sort-trigger" class="text-xs font-medium text-muted-foreground">
          <span class="inline-flex items-center gap-1.5">
            <ArrowUpDown size={11} /> Sort
          </span>
        </Label>
        <Select.Root type="single" bind:value={sortValue}>
          <Select.Trigger id="sort-trigger" class="h-9 w-32">
            {sortLabels[sortValue] ?? "Added"}
          </Select.Trigger>
          <Select.Content>
            {#each Object.entries(sortLabels) as [value, label] (value)}
              <Select.Item {value} {label}>{label}</Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
        <input type="hidden" name="sort" value={sortValue} />
      </div>
      <Button type="submit" size="lg">Apply</Button>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-3">
      {#if activeFilters.length > 0}
        <div class="flex flex-wrap items-center gap-2">
          <span class="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Filters
          </span>
          {#each activeFilters as f (f.key)}
            <span
              class="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 text-xs"
            >
              {f.label}
            </span>
          {/each}
          <a
            href="/books"
            class="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground"
          >
            Clear
          </a>
        </div>
      {:else}
        <span></span>
      {/if}
      <DensityToggle bind:value={density} />
    </div>
  </form>

  <div id="results" tabindex="-1">
    {#if items.length === 0}
      <div
        class="rounded-lg border border-dashed border-border bg-card/50 px-6 py-16 text-center"
      >
        <p class="font-display text-xl">Nothing matches.</p>
        <p class="mt-1 text-sm text-muted-foreground">
          Try a different search or
          <a href="/books" class="font-medium text-foreground underline-offset-4 hover:underline">
            clear the filters</a
          >.
        </p>
      </div>
    {:else}
      <InfiniteList {total} loaded={items.length} {isLoading} label="books" onLoadMore={loadMore}>
        {#if grouped && grouped.groups.length > 0}
          <!-- Grouped by library when no library filter is active -->
          <div class="space-y-10">
            {#each grouped.groups as g (g.id)}
              <LibrarySection library={g} books={g.books} {density} />
            {/each}
            {#if grouped.orphans.length > 0}
              <LibrarySection
                library={{ id: "orphan", name: "Other" }}
                books={grouped.orphans}
                {density}
              />
            {/if}
          </div>
        {:else}
          <!-- Flat: either a library filter is active, or no library data is available.
               aria-setsize uses the server total so SR position announcements stay
               truthful even as items append. -->
          {#if density === "grid"}
            <ul
              class="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
              role="list"
              aria-label="All books"
            >
              {#each items as book, i (book.id)}
                <li role="listitem" aria-posinset={i + 1} aria-setsize={total}>
                  <BookCard {book} />
                </li>
              {/each}
            </ul>
          {:else}
            <ul
              class="divide-y divide-border rounded-lg border border-border bg-card/40"
              role="list"
              aria-label="All books"
            >
              {#each items as book, i (book.id)}
                <li role="listitem" aria-posinset={i + 1} aria-setsize={total}>
                  <BookListRow {book} />
                </li>
              {/each}
            </ul>
          {/if}
        {/if}
      </InfiniteList>
    {/if}
  </div>
</section>
