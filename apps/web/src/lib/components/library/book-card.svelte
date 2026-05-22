<script lang="ts">
  import BookCover from "./book-cover.svelte";
  import FormatLabel from "$lib/components/ui/format-label.svelte";
  import ShelfPicker from "./shelf-picker.svelte";
  import BookmarkPlus from "@lucide/svelte/icons/bookmark-plus";
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

  // The picker hydrates itself on first open (lazy=true), so we start empty.
  let shelves = $state<{ id: string; name: string; bookCount?: number }[]>([]);
  let current = $state<string[]>([]);
  let pickerOpen = $state(false);

  // Press "S" while the card link is focused to open the picker — a calmer
  // alternative to hovering and aiming at the corner icon.
  function onLinkKeydown(e: KeyboardEvent) {
    if (pickerOpen) return;
    if (e.key !== "s" && e.key !== "S") return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    pickerOpen = true;
  }
</script>

<div class={cn("group relative", className)}>
  <a
    href={`/books/${book.id}`}
    onkeydown={onLinkKeydown}
    class="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background rounded-sm"
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

  <div class="pointer-events-none absolute right-1.5 top-1.5 z-10">
    <ShelfPicker
      bookId={book.id}
      bind:shelves
      bind:current
      bind:open={pickerOpen}
      lazy
      align="end"
    >
      {#snippet trigger({ props, open })}
        <button
          {...props}
          type="button"
          aria-label="Add to shelf (S)"
          title="Add to shelf (S)"
          class={cn(
            "pointer-events-auto inline-flex size-7 items-center justify-center rounded-sm",
            "border border-border bg-popover/95 text-muted-foreground shadow-sm backdrop-blur",
            "transition-opacity duration-150 hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            // Hidden until the card is hovered or anything inside it has focus,
            // or the picker is already open. Filled when current shelves > 0.
            open || current.length > 0
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
          )}
        >
          <BookmarkPlus class="size-3.5" aria-hidden="true" />
        </button>
      {/snippet}
    </ShelfPicker>
  </div>
</div>
