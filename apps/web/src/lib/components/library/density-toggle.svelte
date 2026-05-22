<script lang="ts" module>
  export type Density = "grid" | "list";
</script>

<script lang="ts">
  import type { Component } from "svelte";
  import LayoutGrid from "@lucide/svelte/icons/layout-grid";
  import List from "@lucide/svelte/icons/list";
  import { cn } from "$lib/utils";

  let { value = $bindable<Density>("grid") }: { value?: Density } = $props();

  const items: { value: Density; label: string; icon: Component<{ size?: number | string; class?: string }> }[] = [
    { value: "grid", label: "Cover grid", icon: LayoutGrid as Component<{ size?: number | string; class?: string }> },
    { value: "list", label: "List", icon: List as Component<{ size?: number | string; class?: string }> },
  ];
</script>

<div
  class="inline-flex items-center rounded-lg border border-input bg-background p-0.5"
  role="radiogroup"
  aria-label="View density"
>
  {#each items as item (item.value)}
    {@const Icon = item.icon}
    <button
      type="button"
      role="radio"
      aria-checked={value === item.value}
      aria-label={item.label}
      title={item.label}
      onclick={() => (value = item.value)}
      class={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        value === item.value
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon size={14} />
    </button>
  {/each}
</div>
