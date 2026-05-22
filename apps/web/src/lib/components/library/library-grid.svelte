<script lang="ts">
  import BookCard from "./book-card.svelte";

  type Book = {
    id: string;
    title?: string | null;
    fileName: string;
    authors: string[];
    bookType: string;
    pageCount?: number | null;
  };
  let { books }: { books: Book[] } = $props();
</script>

<ul
  class="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
>
  {#each books as book (book.id)}
    <li>
      <BookCard {book} />
    </li>
  {/each}
</ul>
