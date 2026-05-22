<script lang="ts">
  import { cn } from "$lib/utils";
  import {
    formatAspectClass,
    formatLabel,
    type BookFormat,
  } from "$lib/components/ui/format-label.svelte";

  type Props = {
    bookId: string;
    title?: string | null;
    format?: BookFormat | string | null;
    sizes?: string;
    class?: string;
    eager?: boolean;
  };
  let {
    bookId,
    title,
    format,
    sizes = "(max-width: 640px) 45vw, (max-width: 1024px) 25vw, 200px",
    class: className,
    eager = false,
  }: Props = $props();

  let errored = $state(false);
  const aspect = $derived(formatAspectClass(format));
  const label = $derived(formatLabel(format));
</script>

<div
  class={cn(
    "group relative overflow-hidden bg-muted shadow-[0_1px_0_oklch(0_0_0/0.06),0_8px_24px_-12px_oklch(0_0_0/0.20)]",
    "ring-1 ring-black/5 dark:ring-white/5",
    aspect,
    className,
  )}
>
  {#if !errored}
    <img
      src={`/covers/${bookId}`}
      alt={title ? `Cover of ${title}` : ""}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      {sizes}
      class="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.02]"
      onerror={() => (errored = true)}
    />
  {:else}
    <div
      class="flex h-full w-full flex-col items-center justify-center gap-2 p-3 text-center"
    >
      <span class="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      {#if title}
        <span class="line-clamp-4 font-display text-sm leading-snug text-foreground/80">
          {title}
        </span>
      {/if}
    </div>
  {/if}
</div>
