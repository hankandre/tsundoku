<script lang="ts">
  import BookCard from "./book-card.svelte";
  import BookListRow from "./book-list-row.svelte";

  type Book = {
    id: string;
    title?: string | null;
    fileName: string;
    authors: string[];
    bookType: string;
    pageCount?: number | null;
    libraryId?: string;
  };
  type Props = {
    library: { id: number | string; name: string };
    books: Book[];
    density: "grid" | "list";
    headingLevel?: 2 | 3;
  };
  let { library, books, density, headingLevel = 2 }: Props = $props();

  const setSize = $derived(books.length);
  const labelId = $derived(`library-${library.id}-heading`);
</script>

<section aria-labelledby={labelId} class="space-y-4">
  <header class="flex items-baseline justify-between border-b border-border pb-2">
    {#if headingLevel === 2}
      <h2 id={labelId} class="font-display text-2xl tracking-tight">
        <a href={`/libraries/${library.id}`} class="hover:text-primary">{library.name}</a>
      </h2>
    {:else}
      <h3 id={labelId} class="font-display text-xl tracking-tight">
        <a href={`/libraries/${library.id}`} class="hover:text-primary">{library.name}</a>
      </h3>
    {/if}
    <span class="font-mono text-[10px] uppercase tracking-[0.16em] tabular-nums text-muted-foreground">
      {setSize}
      <span class="ml-1">{setSize === 1 ? "book" : "books"}</span>
    </span>
  </header>

  {#if density === "grid"}
    <ul
      class="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
      role="list"
      aria-label={`Covers in ${library.name}`}
    >
      {#each books as book, i (book.id)}
        <li role="listitem" aria-posinset={i + 1} aria-setsize={setSize}>
          <BookCard {book} />
        </li>
      {/each}
    </ul>
  {:else}
    <ul
      class="divide-y divide-border rounded-lg border border-border bg-card/40"
      role="list"
      aria-label={`Books in ${library.name}`}
    >
      {#each books as book, i (book.id)}
        <li role="listitem" aria-posinset={i + 1} aria-setsize={setSize}>
          <BookListRow {book} />
        </li>
      {/each}
    </ul>
  {/if}
</section>
