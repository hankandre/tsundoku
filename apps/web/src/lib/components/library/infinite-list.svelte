<script lang="ts">
  import { onMount, type Snippet } from "svelte";
  import { Button } from "$lib/components/ui/button";

  /**
   * Orchestrates progressive loading for a long list. The caller owns the
   * items array and renders them in `children`; this component handles the
   * load trigger (IntersectionObserver sentinel + visible "Load more" button)
   * and announces additions via an aria-live region.
   *
   * Accessibility contract:
   *   - "Load more" button is always rendered when hasMore. Keyboard/SR users
   *     can reach it via Tab and activate without needing to scroll.
   *   - aria-live="polite" region announces "Loaded N more, showing X of Y"
   *     after each batch.
   *   - When hasMore flips false, the button is replaced with a focusable end
   *     marker (tabindex="-1" + auto-focus) so SR users know the list ends.
   *   - The caller is responsible for setting aria-setsize={total} on each
   *     of its <li>s so position announcements stay truthful.
   */
  type Props = {
    total: number;
    loaded: number;
    isLoading?: boolean;
    label?: string;
    children: Snippet;
    onLoadMore: () => void | Promise<void>;
  };

  let {
    total,
    loaded,
    isLoading = false,
    label = "items",
    children,
    onLoadMore,
  }: Props = $props();

  const hasMore = $derived(loaded < total);

  // Live region copy. Reset on every load so screen readers re-announce.
  let liveMessage = $state("");
  let prevLoaded = loaded;
  $effect(() => {
    if (loaded > prevLoaded) {
      const added = loaded - prevLoaded;
      liveMessage = `Loaded ${added} more ${label}. Showing ${loaded.toLocaleString()} of ${total.toLocaleString()}.`;
    }
    prevLoaded = loaded;
  });

  // IntersectionObserver — fires onLoadMore when sentinel is within ~200px of viewport
  let sentinel: HTMLDivElement | null = $state(null);
  let endMarker: HTMLDivElement | null = $state(null);

  onMount(() => {
    if (!sentinel) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && hasMore && !isLoading) {
            void onLoadMore();
          }
        }
      },
      { rootMargin: "200px 0px" },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  });

  // Move focus to the end marker the first time hasMore flips false, so SR
  // users tabbing through the list reach a clear "end" announcement.
  let endAnnounced = $state(false);
  $effect(() => {
    if (!hasMore && !endAnnounced && total > 0) {
      endAnnounced = true;
      // Defer until DOM update so the element exists.
      queueMicrotask(() => endMarker?.focus({ preventScroll: true }));
    }
  });
</script>

{@render children()}

<!-- The aria-live region. Visually hidden but read by SR after each load. -->
<div role="status" aria-live="polite" aria-atomic="true" class="sr-only">
  {liveMessage}
</div>

{#if hasMore}
  <!-- Sentinel sits just above the button; observer triggers auto-load. -->
  <div bind:this={sentinel} aria-hidden="true" class="h-1"></div>
  <div class="mt-6 flex flex-col items-center gap-2">
    <Button
      type="button"
      variant="secondary"
      onclick={() => void onLoadMore()}
      disabled={isLoading}
    >
      {#if isLoading}
        Loading…
      {:else}
        Load more
      {/if}
    </Button>
    <p class="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
      Showing {loaded.toLocaleString()} of {total.toLocaleString()}
    </p>
  </div>
{:else if total > 0}
  <div
    bind:this={endMarker}
    tabindex="-1"
    class="mt-6 rounded-md border border-dashed border-border bg-card/40 px-4 py-3 text-center text-xs font-mono uppercase tracking-[0.16em] text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  >
    End of the pile · {total.toLocaleString()} {label}
  </div>
{/if}
