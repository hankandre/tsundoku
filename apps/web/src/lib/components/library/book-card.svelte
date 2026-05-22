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
    progress?: number | null;
    class?: string;
  };
  let { book, progress = null, class: className }: Props = $props();
</script>

<a
  href={`/books/${book.id}`}
  class={cn(
    "group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background rounded-sm",
    className,
  )}
>
  <div class="transition-transform duration-200 ease-out group-hover:-translate-y-0.5 motion-reduce:transform-none">
    <BookCover bookId={book.id} title={book.title ?? book.fileName} format={book.bookType} />
  </div>

  {#if progress !== null && progress !== undefined}
    <div class="mt-2 h-px w-full bg-border" aria-hidden="true">
      <div
        class="h-px bg-primary transition-[width] duration-500"
        style:width={`${Math.min(100, Math.max(0, progress * 100))}%`}
      ></div>
    </div>
  {/if}

  <div class="mt-2 space-y-0.5">
    <div class="line-clamp-2 font-display text-sm leading-snug text-foreground">
      {book.title ?? book.fileName}
    </div>
    <div class="line-clamp-1 text-xs text-muted-foreground">
      {book.authors.join(", ") || "—"}
    </div>
    <div class="flex items-center gap-2 pt-0.5">
      <FormatLabel format={book.bookType} />
      {#if book.pageCount}
        <span class="font-mono text-[10px] tracking-wide text-muted-foreground">
          · {book.pageCount}p
        </span>
      {/if}
    </div>
  </div>
</a>
