<script lang="ts">
  import BookOpen from "@lucide/svelte/icons/book-open";
  import Clock from "@lucide/svelte/icons/clock";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import type { PageData } from "./$types";
  import BookCard from "$lib/components/library/book-card.svelte";

  let { data }: { data: PageData } = $props();

  // The loader redirects unauthenticated visitors to /login, so we only need
  // to handle the case where stats failed for an authenticated user — render
  // a placeholder shape instead of crashing.
  const summary = $derived(
    data.summary ?? { totalBooks: 0, byLibrary: [], byFormat: [] },
  );
  const libMax = $derived(Math.max(1, ...summary.byLibrary.map((l) => l.count)));
  const fmtMax = $derived(Math.max(1, ...summary.byFormat.map((f) => f.count)));
</script>

<section class="space-y-10">
  <header class="flex flex-col gap-1">
    <span class="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
      The pile · at a glance
    </span>
    <h1 class="font-display text-4xl tracking-tight">
      {summary.totalBooks.toLocaleString()} books in the pile
    </h1>
  </header>

  {#if data.reading}
    <div class="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
      <div class="bg-card px-5 py-4">
        <div class="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          <BookOpen size={12} />
          Total books
        </div>
        <div class="mt-2 font-display text-3xl tabular-nums">
          {summary.totalBooks.toLocaleString()}
        </div>
      </div>
      <div class="bg-card px-5 py-4">
        <div class="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          <Clock size={12} />
          Minutes read
        </div>
        <div class="mt-2 font-display text-3xl tabular-nums">
          {data.reading.minutesRead.toLocaleString()}
        </div>
      </div>
      <div class="bg-card px-5 py-4">
        <div class="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          <Sparkles size={12} />
          Finished
        </div>
        <div class="mt-2 font-display text-3xl tabular-nums">
          {data.reading.booksFinished.toLocaleString()}
        </div>
      </div>
    </div>
  {/if}

  {#if data.recent.length > 0}
    <section class="space-y-5">
      <header class="flex items-baseline justify-between">
        <h2 class="font-display text-xl tracking-tight">New to the pile</h2>
        <a
          href="/books?sort=addedOn"
          class="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground"
        >
          See all →
        </a>
      </header>
      <ul class="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {#each data.recent.slice(0, 6) as book (book.id)}
          <li><BookCard {book} /></li>
        {/each}
      </ul>
    </section>
  {/if}

  <section class="grid gap-8 lg:grid-cols-2">
    <div class="space-y-4">
      <header class="flex items-baseline justify-between">
        <h2 class="font-display text-xl tracking-tight">By library</h2>
        <a
          href="/libraries"
          class="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground"
        >
          Manage →
        </a>
      </header>
      {#if summary.byLibrary.length === 0}
        <div class="rounded-md border border-dashed border-border bg-card/50 p-6 text-sm text-muted-foreground">
          No libraries yet — the pile starts with a folder.
          <a href="/libraries" class="font-medium text-foreground underline-offset-4 hover:underline">Point tsundoku at one.</a>
        </div>
      {:else}
        <ul class="space-y-3">
          {#each summary.byLibrary as l (l.libraryId)}
            <li>
              <a
                href={`/libraries/${l.libraryId}`}
                class="group block rounded-md px-2 py-1.5 transition-colors hover:bg-accent"
              >
                <div class="mb-1.5 flex items-baseline justify-between text-sm">
                  <span class="font-medium text-foreground">{l.libraryName}</span>
                  <span class="font-mono text-xs tabular-nums text-muted-foreground">
                    {l.count.toLocaleString()}
                  </span>
                </div>
                <div class="h-px w-full bg-border" aria-hidden="true">
                  <div
                    class="h-px bg-primary transition-[width] duration-700 ease-out"
                    style:width={`${(l.count / libMax) * 100}%`}
                  ></div>
                </div>
              </a>
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    <div class="space-y-4">
      <header>
        <h2 class="font-display text-xl tracking-tight">By format</h2>
      </header>
      {#if summary.byFormat.length === 0}
        <div class="rounded-md border border-dashed border-border bg-card/50 p-6 text-sm text-muted-foreground">
          Nothing in the pile yet.
        </div>
      {:else}
        <ul class="space-y-3">
          {#each summary.byFormat as f (f.bookType)}
            <li>
              <a
                href={`/books?bookType=${f.bookType}`}
                class="group block rounded-md px-2 py-1.5 transition-colors hover:bg-accent"
              >
                <div class="mb-1.5 flex items-baseline justify-between text-sm">
                  <span class="font-mono text-[11px] uppercase tracking-[0.14em] text-foreground">
                    {f.bookType}
                  </span>
                  <span class="font-mono text-xs tabular-nums text-muted-foreground">
                    {f.count.toLocaleString()}
                  </span>
                </div>
                <div class="h-px w-full bg-border" aria-hidden="true">
                  <div
                    class="h-px bg-primary transition-[width] duration-700 ease-out"
                    style:width={`${(f.count / fmtMax) * 100}%`}
                  ></div>
                </div>
              </a>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </section>
</section>
