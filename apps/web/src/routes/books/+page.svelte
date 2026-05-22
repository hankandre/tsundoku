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
  import DensityToggle, {
    type Density,
  } from "$lib/components/library/density-toggle.svelte";
  import BooksResults from "$lib/components/library/books-results.svelte";
  import {
    FORMAT_LABELS,
    SORT_LABELS,
    activeBookFilters,
    appendUniqueBooks,
    buildBookPageParams,
    groupBooksByLibrary,
    isDensity,
    type BooksPageBook,
    type SidebarLibrary,
  } from "$lib/books-page";

  let { data }: { data: PageData } = $props();

  // Filter form is seeded from data.filter on each navigation. SvelteKit
  // creates a new component instance on form submission, so $state(...) captures
  // fresh URL-driven values. The Select primitives below bind to these and
  // submit via hidden inputs (bits-ui renders custom HTML, not a real <select>).
  let searchValue = $state(data.filter.search);
  let bookType = $state(data.filter.bookType);
  let sortValue = $state(data.filter.sort);

  // Density: persisted to localStorage so a librarian-mode preference survives
  // navigation. Mount-only read; SSR renders the default to avoid hydration churn.
  let density = $state<Density>("grid");
  onMount(() => {
    try {
      const stored = localStorage.getItem("tsundoku-density");
      if (isDensity(stored)) density = stored;
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
  let items = $state<BooksPageBook[]>([...data.books.content]);
  const total = $derived(data.books.totalElements);
  let nextPage = $state(1); // page 0 already loaded by the server loader
  let isLoading = $state(false);

  async function loadMore() {
    if (isLoading) return;
    if (items.length >= total) return;
    isLoading = true;
    try {
      const params = buildBookPageParams({
        page: nextPage,
        size: data.books.size,
        filter: data.filter,
      });
      const res = await fetch(`/books?${params.toString()}`, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`books page fetch failed: ${res.status}`);
      const body = (await res.json()) as typeof data.books;
      items = appendUniqueBooks(items, body.content);
      nextPage += 1;
    } finally {
      isLoading = false;
    }
  }

  // Libraries come from the layout (sidebar data). When no libraryId filter is
  // active, books get grouped under their parent library; otherwise one flat
  // section is rendered.
  const sidebarLibraries = $derived(
    (page.data?.sidebar?.libraries ?? []) as SidebarLibrary[],
  );

  const grouped = $derived.by(() => {
    return groupBooksByLibrary(items, sidebarLibraries, data.filter.libraryId);
  });

  const activeFilters = $derived.by(() => {
    return activeBookFilters(data.filter, sidebarLibraries);
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
            {FORMAT_LABELS[bookType] ?? "All"}
          </Select.Trigger>
          <Select.Content>
            {#each Object.entries(FORMAT_LABELS) as [value, label] (value)}
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
            {SORT_LABELS[sortValue] ?? "Added"}
          </Select.Trigger>
          <Select.Content>
            {#each Object.entries(SORT_LABELS) as [value, label] (value)}
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
    <BooksResults {items} {total} {density} {grouped} {isLoading} onLoadMore={loadMore} />
  </div>
</section>
