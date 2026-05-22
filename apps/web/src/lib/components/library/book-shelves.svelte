<script lang="ts">
  import Plus from "@lucide/svelte/icons/plus";
  import X from "@lucide/svelte/icons/x";
  import { toast } from "svelte-sonner";
  import ShelfPicker from "./shelf-picker.svelte";
  import { type Shelf, persistBookShelves } from "./shelves-api";

  type Props = {
    bookId: string;
    shelves: Shelf[];
    current: string[];
  };

  let { bookId, shelves = $bindable(), current = $bindable() }: Props = $props();
  let open = $state(false);

  // Lookup keyed by id so chip rendering is O(1) per current shelf, even when
  // the user has many shelves. We don't expect tens of thousands, but the
  // page also renders this inline alongside metadata — cheap is the goal.
  const byId = $derived(new Map(shelves.map((s) => [s.id, s] as const)));
  const assigned = $derived(
    current
      .map((id) => byId.get(id))
      .filter((s): s is Shelf => !!s),
  );

  async function remove(shelfId: string) {
    const before = current;
    const next = current.filter((id) => id !== shelfId);
    current = next;
    try {
      await persistBookShelves(bookId, next);
    } catch (err) {
      current = before;
      toast.error("Couldn't remove from shelf", {
        description: err instanceof Error ? err.message : "Try again.",
      });
    }
  }
</script>

<div class="flex flex-col gap-2">
  <span class="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
    Shelves
  </span>
  <div class="flex flex-wrap items-center gap-1.5">
    {#each assigned as shelf (shelf.id)}
      <span
        class="group/chip inline-flex items-center overflow-hidden rounded-sm border border-border bg-card text-sm"
      >
        <a
          href={`/shelves/${shelf.id}`}
          class="py-0.5 pl-2 pr-1 text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:bg-accent"
        >
          {shelf.name}
        </a>
        <button
          type="button"
          aria-label={`Remove from ${shelf.name}`}
          onclick={() => remove(shelf.id)}
          class="flex h-full items-center px-1.5 text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-none focus-visible:text-destructive"
        >
          <X class="size-3" aria-hidden="true" />
        </button>
      </span>
    {/each}

    <ShelfPicker {bookId} bind:shelves bind:current bind:open align="start">
      {#snippet trigger({ props })}
        <button
          {...props}
          type="button"
          aria-label="Add to shelf"
          aria-expanded={open}
          class="inline-flex items-center gap-1 rounded-sm border border-dashed border-border px-2 py-0.5 text-sm text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Plus class="size-3" aria-hidden="true" />
          {assigned.length === 0 ? "Add to a shelf" : "Add"}
        </button>
      {/snippet}
    </ShelfPicker>
  </div>
</div>
