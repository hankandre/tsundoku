<script lang="ts">
  import Search from "@lucide/svelte/icons/search";
  import Kbd from "$lib/components/ui/kbd.svelte";
  import { cn } from "$lib/utils";

  let { class: className }: { class?: string } = $props();
</script>

<button
  type="button"
  class={cn(
    "group inline-flex h-9 w-full items-center gap-2 rounded-md border border-input bg-background/80 px-3 text-sm text-muted-foreground",
    "transition-colors hover:border-ring hover:text-foreground",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    "sm:w-72",
    className,
  )}
  aria-label="Search"
  onclick={() => alert("Command palette: coming soon")}
>
  <Search size={14} class="shrink-0" />
  <span class="flex-1 truncate text-left">Search the library…</span>
  <span class="hidden items-center gap-1 sm:flex">
    <Kbd>⌘</Kbd>
    <Kbd>K</Kbd>
  </span>
</button>
