<script lang="ts">
  import BookCover from "./book-cover.svelte";
  import FormatLabel from "$lib/components/ui/format-label.svelte";
  import { cn } from "$lib/utils";

  type Props = {
    book: {
      id: string;
      title?: string | null;
      fileName: string;
      authors: string[];
      bookType: string;
      pageCount?: number | null;
    };
    class?: string;
  };
  let { book, class: className }: Props = $props();
</script>

<a
  href={`/books/${book.id}`}
  class={cn(
    "group flex items-center gap-4 rounded-lg border border-transparent px-2 py-2",
    "transition-colors hover:border-border hover:bg-card",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    className,
  )}
>
  <div class="h-14 w-10 shrink-0 sm:h-16 sm:w-12">
    <BookCover bookId={book.id} title={book.title ?? book.fileName} format={book.bookType} />
  </div>
  <div class="min-w-0 flex-1">
    <div class="line-clamp-1 font-display text-base leading-tight text-foreground">
      {book.title ?? book.fileName}
    </div>
    <div class="line-clamp-1 text-xs text-muted-foreground">
      {book.authors.join(", ") || "—"}
    </div>
  </div>
  <div class="hidden items-center gap-3 text-right sm:flex">
    <FormatLabel format={book.bookType} />
    {#if book.pageCount}
      <span class="font-mono text-[10px] tabular-nums text-muted-foreground">
        {book.pageCount}p
      </span>
    {/if}
  </div>
</a>
