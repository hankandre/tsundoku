<script lang="ts">
  import LibrarySection from "$lib/components/library/library-section.svelte";
  import BookListRow from "$lib/components/library/book-list-row.svelte";
  import BookCard from "$lib/components/library/book-card.svelte";
  import InfiniteList from "$lib/components/library/infinite-list.svelte";
  import type { Density } from "$lib/components/library/density-toggle.svelte";
  import type { BookGroupResult, BooksPageBook } from "$lib/books-page";

  type Props = {
    items: BooksPageBook[];
    total: number;
    density: Density;
    grouped: BookGroupResult | null;
    isLoading: boolean;
    onLoadMore: () => void | Promise<void>;
  };

  let { items, total, density, grouped, isLoading, onLoadMore }: Props = $props();

  const hasLibraryGroups = $derived(Boolean(grouped?.groups.length));
</script>

{#if items.length === 0}
  <div class="rounded-lg border border-dashed border-border bg-card/50 px-6 py-16 text-center">
    <p class="font-display text-xl">Nothing matches.</p>
    <p class="mt-1 text-sm text-muted-foreground">
      Try a different search or
      <a href="/books" class="font-medium text-foreground underline-offset-4 hover:underline">
        clear the filters</a
      >.
    </p>
  </div>
{:else}
  <InfiniteList {total} loaded={items.length} {isLoading} label="books" {onLoadMore}>
    {#if grouped && hasLibraryGroups}
      <div class="space-y-10">
        {#each grouped.groups as group (group.id)}
          <LibrarySection library={group} books={group.books} {density} />
        {/each}
        {#if grouped.orphans.length > 0}
          <LibrarySection
            library={{ id: "orphan", name: "Other" }}
            books={grouped.orphans}
            {density}
          />
        {/if}
      </div>
    {:else if density === "grid"}
      <ul
        class="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
        role="list"
        aria-label="All books"
      >
        {#each items as book, index (book.id)}
          <li role="listitem" aria-posinset={index + 1} aria-setsize={total}>
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
        {#each items as book, index (book.id)}
          <li role="listitem" aria-posinset={index + 1} aria-setsize={total}>
            <BookListRow {book} />
          </li>
        {/each}
      </ul>
    {/if}
  </InfiniteList>
{/if}
